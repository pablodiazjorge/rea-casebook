// Reads what a rea MCP call returned into something the casebook can keep (ADR 0015 of rea-lab).
// No `$`: tested directly.

import type { EvidenceItem, Target, Unknown } from '../types'

/** What one rea result means for the casebook. */
export type ReaOutcome =
  | { kind: 'evidence'; item: EvidenceItem }
  // record_unknown, update_unknown and list_unknowns answer with the unknowns themselves, not an
  // Evidence record; each revision names the mutation Evidence rea stored for it.
  | { kind: 'unknowns'; unknowns: Unknown[]; mutations: Mutation[] }
  | { kind: 'opened'; target: Target }
  | { kind: 'closed' }
  | { kind: 'saved'; path: string }
  | { kind: 'error'; message: string }
  | { kind: 'other' }

/** A mutation Evidence id and the question of the unknown it belongs to. */
export type Mutation = { id: string; question: string }

const EVIDENCE_ID = /^ev_[0-9a-f]{64}$/u
// Claude Code may append a reminder block to tool results; it is not part of what rea returned.
const REMINDER = /\s*<system-reminder>[\s\S]*<\/system-reminder>\s*$/u
// A large result is replaced by a note that names the file where the client saved it.
const SAVED = /exceeds maximum allowed tokens\. Output has been saved to (.+?\.txt)\./u

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Parses a result text as one closed JSON value, or returns undefined. */
export function closedJson(raw: string): unknown {
  try {
    return JSON.parse(raw.replace(REMINDER, ''))
  } catch {
    return undefined
  }
}

/** The call's scalar parameters, short, for one line of the timeline. */
export function detailOf(parameters: unknown): string {
  if (!isObject(parameters)) return ''
  return Object.entries(parameters)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 2)
    .map(([key, value]) => `${key}=${String(value).slice(0, 40)}`)
    .join(' ')
}

const isUnknown = (value: unknown): value is Json => isObject(value) && typeof value.unknown_id === 'string' && typeof value.question === 'string'

/** The residual unknowns in a session tool's `result`: one record, or a page of them under `items`. */
function unknownsOf(result: unknown): Json[] {
  if (isUnknown(result)) return [result]
  if (isObject(result) && Array.isArray(result.items)) return result.items.filter(isUnknown)
  return []
}

/**
 * The text of a result the client saved to a file: the content blocks' text joined when the file
 * holds them as JSON, the file's text as it is otherwise.
 */
export function savedText(raw: string): string {
  const parsed = closedJson(raw)
  if (!Array.isArray(parsed) || !parsed.every((block) => isObject(block) && typeof block.text === 'string')) return raw
  return parsed.map((block) => String((block as Json).text)).join('')
}

/** Reads one rea result. `tool` is the rea tool name without the mcp__rea__ prefix. */
export function readReaResult(tool: string, resultText: string, isError: boolean, at: number): ReaOutcome {
  if (isError) return { kind: 'error', message: resultText.slice(0, 200) }
  const saved = SAVED.exec(resultText)?.[1]
  if (saved) return { kind: 'saved', path: saved }
  const payload = closedJson(resultText)
  if (!isObject(payload)) return { kind: 'other' }
  if (typeof payload.evidence_id === 'string' && EVIDENCE_ID.test(payload.evidence_id) && typeof payload.operation === 'string') {
    const item: EvidenceItem = {
      id: payload.evidence_id,
      operation: payload.operation,
      confidence: text(payload.confidence),
      authority: text(payload.authority),
      detail: detailOf(payload.parameters),
      limitations: Array.isArray(payload.limitations) ? payload.limitations.length : 0,
      at,
    }
    return { kind: 'evidence', item }
  }
  if (tool === 'open_binary' && isObject(payload.result) && typeof payload.result.path === 'string') {
    const result = payload.result
    return { kind: 'opened', target: { path: text(result.path), sha256: text(result.sha256), format: text(result.format), architecture: text(result.architecture) } }
  }
  const records = unknownsOf(payload.result)
  if (records.length > 0) {
    const unknowns = records.map((record) => ({ id: text(record.unknown_id), question: text(record.question), status: text(record.status), severity: text(record.severity), at }))
    const mutations = records.flatMap((record) =>
      (Array.isArray(record.mutation_evidence_ids) ? record.mutation_evidence_ids : [])
        .filter((id): id is string => typeof id === 'string' && EVIDENCE_ID.test(id))
        .map((id) => ({ id, question: text(record.question) })),
    )
    return { kind: 'unknowns', unknowns, mutations }
  }
  if (tool === 'close_binary') return { kind: 'closed' }
  return { kind: 'other' }
}

/** The file name of a path, for display; the full path stays in the state. */
export const baseName = (path: string) => path.split(/[\\/]/u).pop() ?? path
