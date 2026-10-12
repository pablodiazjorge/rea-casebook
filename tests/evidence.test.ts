import { describe, expect, test } from 'claude-code/testing'

import { baseName, closedJson, detailOf, readReaResult, savedText } from '../hooks/evidence'
import { closeBinary, inputError, listUnknowns, openBinary, pseudoCode, recordUnknown, searchStrings } from './fixtures/rea'

const AT = 1000

describe('reading rea results', () => {
  test('an Evidence record keeps its id, operation, confidence, authority and main parameters', () => {
    const outcome = readReaResult('search_strings', searchStrings, false, AT)
    expect(outcome).toEqual({
      kind: 'evidence',
      item: {
        id: 'ev_f5061e3dcffd337c10b39ea099668c1e8d593071fa6fa9afae479f75d428ac1d',
        operation: 'search_strings',
        confidence: 'observed',
        authority: 'shipped-artifact',
        detail: 'pattern=ACCESS mode=literal',
        limitations: 9,
        at: AT,
      },
    })
    const pseudo = readReaResult('procedure_pseudo_code', pseudoCode, false, AT)
    expect(pseudo.kind === 'evidence' && pseudo.item.detail).toBe('procedure=0x140001020')
  })

  test('open_binary gives the target and close_binary closes it', () => {
    expect(readReaResult('open_binary', openBinary, false, AT)).toEqual({
      kind: 'opened',
      target: { path: 'D:\\cases\\target.exe', sha256: '6cf93627a64afece55fb168f6f10cc0ef5259bc83b42e997395d16b270d4a238', format: 'pe', architecture: 'x86_64' },
    })
    expect(readReaResult('close_binary', closeBinary, false, AT)).toEqual({ kind: 'closed' })
  })

  test('record_unknown and list_unknowns give the unknowns and their mutation Evidence', () => {
    const recorded = readReaResult('record_unknown', recordUnknown, false, AT)
    expect(recorded.kind).toBe('unknowns')
    if (recorded.kind !== 'unknowns') return
    expect(recorded.unknowns).toEqual([
      { id: expect.stringMatching(/^unk_/u), question: 'Which routine validates the serial before the success message?', status: 'open', severity: 'medium', at: AT },
    ])
    expect(recorded.mutations).toEqual([{ id: expect.stringMatching(/^ev_/u), question: 'Which routine validates the serial before the success message?' }])
    const listed = readReaResult('list_unknowns', listUnknowns, false, AT)
    expect(listed.kind === 'unknowns' && listed.unknowns.map((unknown) => unknown.id)).toEqual(recorded.unknowns.map((unknown) => unknown.id))
  })

  test('an error, a saved result and anything else are told apart', () => {
    expect(readReaResult('search_strings', inputError, true, AT)).toEqual({ kind: 'error', message: inputError })
    const note = 'Error: result (61,234 tokens) exceeds maximum allowed tokens. Output has been saved to D:\\tmp\\out file.txt.\nUse offset and limit.'
    expect(readReaResult('list_procedures', note, false, AT)).toEqual({ kind: 'saved', path: 'D:\\tmp\\out file.txt' })
    expect(readReaResult('binary_session', '{"result":{"open":null}}', false, AT)).toEqual({ kind: 'other' })
    expect(readReaResult('search_strings', 'not json', false, AT)).toEqual({ kind: 'other' })
  })

  test('a reminder the client appends does not break the JSON', () => {
    expect(closedJson(`${closeBinary}\n\n<system-reminder>\nSomething.\n</system-reminder>`)).toEqual({ result: null })
  })

  test('a saved file holds either the content blocks or the text itself', () => {
    expect(savedText(JSON.stringify([{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }]))).toBe('{"a":1}')
    expect(savedText(searchStrings)).toBe(searchStrings)
  })

  test('details and names are short', () => {
    expect(detailOf({ procedure: '0x1', depth: 2, nested: { x: 1 }, third: true })).toBe('procedure=0x1 depth=2')
    expect(detailOf(null)).toBe('')
    expect(baseName('D:\\cases\\target.exe')).toBe('target.exe')
    expect(baseName('/home/me/target')).toBe('target')
  })
})
