import { describe, expect, test } from 'claude-code/testing'

import { clip, formatSeconds, langOf, words } from '../hooks/messages'

describe('messages', () => {
  test('Spanish only when the option says so', () => {
    for (const option of ['Español', 'espanol', 'es', ' Spanish ']) expect(langOf(option)).toBe('es')
    for (const option of ['English', 'esperanto', '', undefined, 3]) expect(langOf(option)).toBe('en')
  })

  test('seconds read as the pane shows them', () => {
    expect(formatSeconds(0)).toBe('0 s')
    expect(formatSeconds(42_400)).toBe('42 s')
    expect(formatSeconds(185_000)).toBe('3 min 05 s')
    expect(formatSeconds(-5)).toBe('0 s')
  })

  test('a long text is cut with an ellipsis, a short one is left alone', () => {
    expect(clip('short', 10)).toBe('short')
    expect(clip('a claim that runs on', 10)).toBe('a claim…')
    expect(clip('a claim that runs on', 10).length).toBeLessThanOrEqual(10)
  })

  test('English and Spanish have the same words, and Claude reads the tool in English in both', () => {
    expect(Object.keys(words('es')).sort()).toEqual(Object.keys(words('en')).sort())
    expect(words('es').toolDescription).toBe(words('en').toolDescription)
    expect(words('es').unknownEvidence(['ev_1', 'ev_2'])).toContain('estos evidence_id')
  })
})
