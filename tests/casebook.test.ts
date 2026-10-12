import { describe, expect, test } from 'claude-code/testing'

import { callEnded, callStarted, EMPTY_CASE, findingRefused, oldestPending, recordFinding, targetLabel } from '../hooks/casebook'
import type { EvidenceItem } from '../types'

const id = (n: number) => `ev_${String(n).padStart(64, '0')}`
const item = (n: number, operation = 'search_strings'): EvidenceItem => ({ id: id(n), operation, confidence: 'observed', authority: 'shipped-artifact', detail: '', limitations: 0, at: n })
const target = { path: 'D:\\cases\\a.exe', sha256: 'aa', format: 'pe', architecture: 'x86_64' }

describe('the casebook state', () => {
  test('a call is pending from its start to its end', () => {
    const started = callStarted(EMPTY_CASE, 't1', 'list_procedures', 100)
    expect(oldestPending(started)).toEqual({ id: 't1', tool: 'list_procedures', since: 100 })
    const ended = callEnded(started, 't1', 'list_procedures', { kind: 'other' }, 200)
    expect(ended.pending).toEqual([])
  })

  test('the first call that waits for Ghidra sets the cold start; quick tools never do', () => {
    let state = callStarted(EMPTY_CASE, 'q', 'open_binary', 0)
    state = callEnded(state, 'q', 'open_binary', { kind: 'opened', target }, 300)
    state = callStarted(state, 's', 'binary_session', 400)
    state = callEnded(state, 's', 'binary_session', { kind: 'evidence', item: item(1, 'binary_session') }, 500)
    expect(state.coldStartMs).toBeNull()
    state = callStarted(state, 'p', 'list_procedures', 1_000)
    state = callEnded(state, 'p', 'list_procedures', { kind: 'evidence', item: item(2) }, 61_000)
    expect(state.coldStartMs).toBe(60_000)
    state = callStarted(state, 'p2', 'list_strings', 70_000)
    state = callEnded(state, 'p2', 'list_strings', { kind: 'evidence', item: item(3) }, 70_500)
    expect(state.coldStartMs).toBe(60_000)
  })

  test('Evidence is kept once, and a second binary keeps what came before', () => {
    let state = callEnded(EMPTY_CASE, 'a', 'search_strings', { kind: 'evidence', item: item(1) }, 1)
    state = callEnded(state, 'b', 'search_strings', { kind: 'evidence', item: item(1) }, 2)
    expect(state.evidence).toHaveLength(1)
    state = callEnded(state, 'c', 'open_binary', { kind: 'opened', target: { ...target, path: 'D:\\cases\\b.exe' } }, 3)
    expect(state.evidence).toHaveLength(1)
    expect(targetLabel(state.target)).toBe('b.exe')
  })

  test('unknowns are updated by id and their mutation Evidence counts as delivered', () => {
    const unknown = { id: 'unk_1', question: 'Which routine?', status: 'open', severity: 'medium', at: 1 }
    const mutation = (n: number) => ({ id: id(n), question: unknown.question })
    let state = callEnded(EMPTY_CASE, 'a', 'record_unknown', { kind: 'unknowns', unknowns: [unknown], mutations: [mutation(7)] }, 1)
    state = callEnded(state, 'b', 'update_unknown', { kind: 'unknowns', unknowns: [{ ...unknown, status: 'resolved' }], mutations: [mutation(7), mutation(8)] }, 2)
    expect(state.unknowns).toEqual([{ ...unknown, status: 'resolved' }])
    expect(state.evidence.map((evidence) => evidence.id)).toEqual([id(7), id(8)])
    // The timeline names the question, since a mutation record has no parameters of its own.
    expect(state.evidence[1]).toMatchObject({ operation: 'update_unknown', detail: 'question=Which routine?' })
  })

  test('close_binary clears the waits', () => {
    const state = callStarted(EMPTY_CASE, 'p', 'list_procedures', 0)
    expect(callEnded(state, 'c', 'close_binary', { kind: 'closed' }, 1).pending).toEqual([])
  })
})

describe('record_finding', () => {
  const delivered = callEnded(EMPTY_CASE, 'a', 'search_strings', { kind: 'evidence', item: item(1) }, 1)

  test('records a finding that cites only delivered Evidence, numbered in order', () => {
    const first = recordFinding(delivered, { claim: '  It prints ACCESS GRANTED.  ', evidence_ids: [id(1), id(1)] }, 10)
    expect(first).toEqual({ ok: true, state: expect.anything(), finding: { id: 'F1', claim: 'It prints ACCESS GRANTED.', evidenceIds: [id(1)], confidence: 'derived', at: 10 } })
    if (!first.ok) return
    const second = recordFinding(first.state, { claim: 'Again.', evidence_ids: [id(1)], confidence: 'observed' }, 11)
    expect(second.ok && second.finding.id).toBe('F2')
  })

  test('refuses an id rea never delivered, naming each missing one', () => {
    expect(recordFinding(delivered, { claim: 'X', evidence_ids: [id(1), id(2), id(3)] }, 10)).toEqual({ ok: false, reason: 'unknown_evidence', missing: [id(2), id(3)] })
    expect(findingRefused(delivered).refused).toBe(1)
  })

  test('refuses a malformed call, naming each field', () => {
    expect(recordFinding(delivered, {}, 10)).toEqual({ ok: false, reason: 'invalid', problems: ['claim', 'evidence_ids'] })
    expect(recordFinding(delivered, { claim: 'X', evidence_ids: ['ev_short'], confidence: 'certain' }, 10)).toEqual({
      ok: false,
      reason: 'invalid',
      problems: ['evidence_ids', 'confidence'],
    })
  })
})
