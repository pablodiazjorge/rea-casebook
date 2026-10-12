import { describe, expect, test } from 'claude-code/testing'

import { EMPTY_CASE } from '../hooks/casebook'
import { caseToMarkdown } from '../hooks/markdown'
import type { CaseState } from '../types'

const ID = `ev_${'a'.repeat(64)}`
const MUTATION = `ev_${'b'.repeat(64)}`

const CASE: CaseState = {
  ...EMPTY_CASE,
  target: { path: 'D:\\cases\\target.exe', sha256: 'c'.repeat(64), format: 'pe', architecture: 'x86_64' },
  coldStartMs: 83_000,
  evidence: [
    { id: ID, operation: 'search_strings', confidence: 'observed', authority: 'shipped-artifact', detail: 'pattern=ACCESS', limitations: 2, at: 1 },
    { id: MUTATION, operation: 'record_unknown', confidence: '', authority: '', detail: '', limitations: 0, at: 2 },
  ],
  unknowns: [{ id: 'unk_1', question: 'Which routine | checks it?', status: 'open', severity: 'medium', at: 2 }],
  findings: [{ id: 'F1', claim: 'It prints\nACCESS GRANTED.', evidenceIds: [ID], confidence: 'observed', at: 3 }],
}

describe('the Markdown export', () => {
  test('lists the target, the findings with their Evidence, the unknowns and the Evidence', () => {
    expect(caseToMarkdown(CASE, 'en')).toBe(
      [
        '# Casebook: target.exe',
        '',
        '## Target',
        '',
        '- pe x86_64',
        `- SHA-256 \`${'c'.repeat(64)}\``,
        '- Ghidra cold start: 1\u00a0min 23\u00a0s',
        '',
        '## Findings',
        '',
        '| # | Finding | Evidence | Confidence | Authority |',
        '|---|---|---|---|---|',
        '| F1 | It prints ACCESS GRANTED. | `ev_aaaaaaaaaaaaaaaa` | observed | shipped-artifact |',
        '',
        '## Open unknowns',
        '',
        '| Question | Severity | Status |',
        '|---|---|---|',
        '| Which routine \\| checks it? | medium | open |',
        '',
        '## Evidence',
        '',
        '| Operation | Confidence | Authority | evidence_id |',
        '|---|---|---|---|',
        `| search_strings pattern=ACCESS | observed | shipped-artifact | \`${ID}\` |`,
        `| record_unknown | - | - | \`${MUTATION}\` |`,
        '',
      ].join('\n'),
    )
  })

  test('an empty case says so in each section, in Spanish too', () => {
    const markdown = caseToMarkdown(EMPTY_CASE, 'es')
    expect(markdown.startsWith('# Casebook: -\n')).toBe(true)
    expect(markdown.match(/^Ninguno\.$/gmu)).toHaveLength(3)
    expect(markdown).toContain('## Hallazgos')
  })
})
