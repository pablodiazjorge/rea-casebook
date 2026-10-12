// The session's journal (ADR 0016 of rea-lab): one JSONL file per session under ~/.rea-casebook/,
// rebuilt from the casebook on every change, so it survives the session and never lands in the
// person's project. No `$`: tested directly.

import type { CaseState } from '../types'

export const JOURNAL_FOLDER = '.rea-casebook'

const twoDigits = (value: number) => String(value).padStart(2, '0')

/** The local day of a time, as the journal names its folders: 2026-10-12. */
export function dayOf(at: number): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
}

/**
 * `<home>/.rea-casebook/<day>/<session>`, with the home's own separator. Callers add the extension as
 * fixed text (`.jsonl`, `.html`), so what kind of file the mod writes is visible where it writes it.
 */
export function casebookBase(home: string, sessionId: string, startedAt: number): string {
  const separator = home.includes('\\') ? '\\' : '/'
  const session = sessionId.replace(/[^\w-]/gu, '').slice(0, 64) || 'session'
  return [home.replace(/[\\/]+$/u, ''), JOURNAL_FOLDER, dayOf(startedAt), session].join(separator)
}

// Files coding agents read as instructions or settings: an export never overwrites one.
const AGENT_FILES = /(?:^|[\\/])(?:claude|agents|gemini)\.md$|(?:^|[\\/])\.claude(?:[\\/]|$)/iu

/**
 * The file `/casebook export` writes, without its `.md` extension (the caller adds it as fixed text),
 * or null when the name points at an agent's instructions or settings.
 */
export function exportStem(requested: string, target: string | null): string | null {
  const name = target ? target.replace(/[^\w.-]+/gu, '-') : ''
  const chosen = requested || (name ? `casebook-${name}` : 'casebook')
  const stem = chosen.replace(/\.md$/iu, '')
  return AGENT_FILES.test(`${stem}.md`) ? null : stem
}

/** Whether the session has anything worth a journal: a binary opened or Evidence delivered. */
export const hasCase = (state: CaseState) => state.target !== null || state.evidence.length > 0

/**
 * The journal's lines: a header with the session and its counters, the target, then the Evidence,
 * unknowns and findings in the order they happened. The target is named by its file name and
 * SHA-256, never by its local path, which can hold the person's user name.
 */
export function journalLines(state: CaseState, sessionId: string, version: string): string {
  const header = {
    type: 'casebook',
    version,
    session: sessionId,
    startedAt: state.startedAt,
    coldStartMs: state.coldStartMs,
    refused: state.refused,
    artifactUrl: state.artifactUrl,
  }
  const events = [
    ...state.evidence.map((item) => ({ type: 'evidence', ...item })),
    ...state.unknowns.map((unknown) => ({ type: 'unknown', ...unknown })),
    ...state.findings.map((finding) => ({ type: 'finding', ...finding })),
  ].sort((left, right) => left.at - right.at)
  const target = state.target
    ? [{ type: 'target', name: state.target.path.split(/[\\/]/u).pop() ?? '', sha256: state.target.sha256, format: state.target.format, architecture: state.target.architecture }]
    : []
  const lines = [header, ...target, ...events]
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`
}
