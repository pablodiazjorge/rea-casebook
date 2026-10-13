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
 * `<home>/.rea-casebook/<day>/<session>`, with the home's own separator: every file the mod writes is
 * this path plus an extension the caller adds as fixed text (`.jsonl`, `.html`, `.md`), so what kind
 * of file it writes is visible where it writes it. The session id is cut to letters, digits, `_` and
 * `-`, so the path never leaves its day folder.
 */
export function casebookBase(home: string, sessionId: string, startedAt: number): string {
  const separator = home.includes('\\') ? '\\' : '/'
  const session = sessionId.replace(/[^\w-]/gu, '').slice(0, 64) || 'session'
  return [home.replace(/[\\/]+$/u, ''), JOURNAL_FOLDER, dayOf(startedAt), session].join(separator)
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
