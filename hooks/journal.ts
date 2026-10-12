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

/** `<home>/.rea-casebook/<day>/<session>.<extension>`, with the home's own separator. */
export function casebookPath(home: string, sessionId: string, startedAt: number, extension: 'jsonl' | 'html'): string {
  const separator = home.includes('\\') ? '\\' : '/'
  const session = sessionId.replace(/[^\w-]/gu, '').slice(0, 64) || 'session'
  return [home.replace(/[\\/]+$/u, ''), JOURNAL_FOLDER, dayOf(startedAt), `${session}.${extension}`].join(separator)
}

/** Whether the session has anything worth a journal: a binary opened or Evidence delivered. */
export const hasCase = (state: CaseState) => state.target !== null || state.evidence.length > 0

/**
 * The journal's lines: a header with the session and its counters, the target, then the Evidence,
 * unknowns and findings in the order they happened. The target keeps its full local path: the
 * journal stays in the person's home; only exports drop it.
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
  const lines = [header, ...(state.target ? [{ type: 'target', ...state.target }] : []), ...events]
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`
}
