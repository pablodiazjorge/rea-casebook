// The casebook's state changes, as pure functions over CaseState. No `$`: tested directly.

import type { CaseState, EvidenceItem, Finding, Target, Unknown } from '../types'
import type { ReaOutcome } from './evidence'

export const EMPTY_CASE: CaseState = {
  target: null,
  pending: [],
  coldStartMs: null,
  evidence: [],
  unknowns: [],
  findings: [],
  refused: 0,
}

// A finding may cite only what is kept, so the cap is far above a long session's few hundred calls.
const MAX_EVIDENCE = 2000
const CONFIDENCE = new Set(['observed', 'derived', 'inferred'])
const EVIDENCE_ID = /^ev_[0-9a-f]{64}$/u

/** A rea call starts. */
export const callStarted = (state: CaseState, id: string, tool: string, at: number): CaseState => ({
  ...state,
  pending: [...state.pending.filter((call) => call.id !== id), { id, tool, since: at }],
})

/** Tools that never wait for Ghidra: their duration says nothing about the cold start. */
const QUICK = new Set(['open_binary', 'close_binary', 'binary_session', 'get_evidence_bundle'])
export const isQuick = (tool: string) => QUICK.has(tool)

/** A rea call ends; its outcome updates the target, the evidence, the unknowns and the cold start. */
export function callEnded(state: CaseState, id: string, tool: string, outcome: ReaOutcome, at: number): CaseState {
  const started = state.pending.find((call) => call.id === id)
  const next: CaseState = { ...state, pending: state.pending.filter((call) => call.id !== id) }
  // A second open_binary keeps what came before: comparing two builds needs the Evidence of both.
  if (outcome.kind === 'opened') return { ...next, target: outcome.target }
  if (outcome.kind === 'closed') return { ...next, pending: [] }
  if (outcome.kind === 'unknowns') {
    // The mutation Evidence reached the model too, so a finding may cite it.
    const added = outcome.mutations.map(
      (mutation): EvidenceItem => ({ id: mutation.id, operation: tool, confidence: '', authority: '', detail: `question=${mutation.question.slice(0, 40)}`, limitations: 0, at }),
    )
    return { ...next, evidence: addEvidence(next.evidence, added), unknowns: outcome.unknowns.reduce(upsertUnknown, next.unknowns) }
  }
  if (outcome.kind !== 'evidence') return next
  const isFirstAnalysis = next.coldStartMs === null && !QUICK.has(tool) && started !== undefined
  return {
    ...next,
    evidence: addEvidence(next.evidence, [outcome.item]),
    coldStartMs: isFirstAnalysis ? at - started.since : next.coldStartMs,
  }
}

/** Adds the records not yet kept, oldest dropped past the cap. */
function addEvidence(list: EvidenceItem[], items: EvidenceItem[]): EvidenceItem[] {
  const kept = new Set(list.map((item) => item.id))
  const added = items.filter((item) => !kept.has(item.id) && kept.add(item.id))
  return added.length === 0 ? list : [...list, ...added].slice(-MAX_EVIDENCE)
}

const upsertUnknown = (list: Unknown[], unknown: Unknown) => [...list.filter((item) => item.id !== unknown.id), unknown]

/** The input of the record_finding tool, as the model sends it. */
export type FindingInput = { claim?: unknown; evidence_ids?: unknown; confidence?: unknown }

export type FindingOutcome =
  | { ok: true; state: CaseState; finding: Finding }
  | { ok: false; reason: 'invalid'; problems: string[] }
  | { ok: false; reason: 'unknown_evidence'; missing: string[] }

/**
 * Records a finding only when every evidence_id it cites was delivered by rea in this session, so the
 * model cannot back a claim with an invented or foreign id.
 */
export function recordFinding(state: CaseState, input: FindingInput, at: number): FindingOutcome {
  const problems: string[] = []
  const claim = typeof input.claim === 'string' ? input.claim.trim() : ''
  if (!claim) problems.push('claim')
  const ids = Array.isArray(input.evidence_ids) ? input.evidence_ids.filter((id): id is string => typeof id === 'string') : []
  if (ids.length === 0 || ids.some((id) => !EVIDENCE_ID.test(id))) problems.push('evidence_ids')
  const confidence = typeof input.confidence === 'string' ? input.confidence : 'derived'
  if (!CONFIDENCE.has(confidence)) problems.push('confidence')
  if (problems.length > 0) return { ok: false, reason: 'invalid', problems }
  const delivered = new Set(state.evidence.map((item) => item.id))
  const missing = [...new Set(ids)].filter((id) => !delivered.has(id))
  if (missing.length > 0) return { ok: false, reason: 'unknown_evidence', missing }
  const finding: Finding = { id: `F${state.findings.length + 1}`, claim, evidenceIds: [...new Set(ids)], confidence, at }
  return { ok: true, state: { ...state, findings: [...state.findings, finding] }, finding }
}

/** Counts a refused finding, for the pane. */
export const findingRefused = (state: CaseState): CaseState => ({ ...state, refused: state.refused + 1 })

/** The longest-running pending call, for the pane's Ghidra counter. */
export const oldestPending = (state: CaseState) =>
  state.pending.reduce<CaseState['pending'][number] | null>((oldest, call) => (oldest === null || call.since < oldest.since ? call : oldest), null)

export const targetLabel = (target: Target | null) => target?.path.split(/[\\/]/u).pop() ?? null
