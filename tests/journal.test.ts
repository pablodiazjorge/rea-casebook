import { describe, expect, test } from 'claude-code/testing'

import { EMPTY_CASE } from '../hooks/casebook'
import { casebookBase, dayOf, exportStem, hasCase, journalLines } from '../hooks/journal'
import type { CaseState } from '../types'

const AT = new Date(2026, 9, 12, 23, 30).getTime()
const ID = `ev_${'a'.repeat(64)}`

describe('the journal', () => {
  test('lives under the home folder, one day folder per date, one file per session', () => {
    expect(dayOf(AT)).toBe('2026-10-12')
    expect(casebookBase('D:\\home\\tester', 'a1b2-c3', AT)).toBe('D:\\home\\tester\\.rea-casebook\\2026-10-12\\a1b2-c3')
    expect(casebookBase('/home/tester/', 'a1b2-c3', AT)).toBe('/home/tester/.rea-casebook/2026-10-12/a1b2-c3')
  })

  test('a session id never leaves its folder', () => {
    expect(casebookBase('/home/tester', '../../evil', AT)).toBe('/home/tester/.rea-casebook/2026-10-12/evil')
    expect(casebookBase('/home/tester', '..', AT)).toBe('/home/tester/.rea-casebook/2026-10-12/session')
  })

  test('the Markdown export is always a .md file and never an agent instructions or settings file', () => {
    expect(exportStem('', 'c01 compare.exe')).toBe('casebook-c01-compare.exe')
    expect(exportStem('', null)).toBe('casebook')
    expect(exportStem('notes\\case.md', null)).toBe('notes\\case')
    expect(exportStem('report', null)).toBe('report')
    for (const name of ['CLAUDE.md', 'docs/agents.md', 'GEMINI', '.claude/settings', 'D:\\repo\\.claude\\notes.md']) expect(exportStem(name, null)).toBeNull()
  })

  test('is written only once the session has a case', () => {
    expect(hasCase(EMPTY_CASE)).toBe(false)
    expect(hasCase({ ...EMPTY_CASE, target: { path: 'a.exe', sha256: '', format: 'pe', architecture: 'x86' } })).toBe(true)
  })

  test('holds a header, the target with its full path, then what happened in order', () => {
    const state: CaseState = {
      ...EMPTY_CASE,
      startedAt: AT,
      coldStartMs: 17_000,
      target: { path: 'D:\\cases\\target.exe', sha256: 'c'.repeat(64), format: 'pe', architecture: 'x86_64' },
      evidence: [{ id: ID, operation: 'search_strings', confidence: 'observed', authority: 'shipped-artifact', detail: 'pattern=ACCESS', limitations: 0, at: 2 }],
      unknowns: [{ id: 'unk_1', question: 'Which routine?', status: 'open', severity: 'low', at: 3 }],
      findings: [{ id: 'F1', claim: 'It prints ACCESS GRANTED.', evidenceIds: [ID], confidence: 'observed', at: 1 }],
    }
    const lines = journalLines(state, 'sess-1', '0.2.0').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines.map((line) => line.type)).toEqual(['casebook', 'target', 'finding', 'evidence', 'unknown'])
    expect(lines[0]).toEqual({ type: 'casebook', version: '0.2.0', session: 'sess-1', startedAt: AT, coldStartMs: 17_000, refused: 0, artifactUrl: null })
    expect(lines[1]).toMatchObject({ path: 'D:\\cases\\target.exe' })
  })
})
