// The casebook as a Markdown report, in the shape of rea-lab's writeups (ADR 0012): findings with
// their evidence_id values, confidence and authority, then the Evidence and the open unknowns.
// No `$`: tested directly.

import type { CaseState } from '../types'
import { formatSeconds, words, type Lang } from './messages'

const cell = (value: string) => value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ')
const shortId = (id: string) => `\`${id.slice(0, 19)}\``

export function caseToMarkdown(state: CaseState, lang: Lang): string {
  const w = words(lang)
  const c = w.markdownColumns
  const target = state.target?.path.split(/[\\/]/u).pop() ?? '-'
  const lines: string[] = [`# ${w.markdownTitle(target)}`, '']
  if (state.target) {
    lines.push(`## ${w.markdownTarget}`, '', `- ${state.target.format} ${state.target.architecture}`, `- SHA-256 \`${state.target.sha256}\``)
    if (state.coldStartMs !== null) lines.push(`- ${w.coldStart(formatSeconds(state.coldStartMs))}`)
    lines.push('')
  }
  const authorityOf = new Map(state.evidence.map((item) => [item.id, item.authority]))
  lines.push(`## ${w.markdownFindings}`, '')
  if (state.findings.length === 0) lines.push(w.markdownNone)
  else {
    lines.push(`| # | ${c.finding} | ${c.evidence} | ${c.confidence} | ${c.authority} |`, '|---|---|---|---|---|')
    for (const finding of state.findings) {
      const authorities = [...new Set(finding.evidenceIds.map((id) => authorityOf.get(id) || '-'))].join(', ')
      lines.push(`| ${finding.id} | ${cell(finding.claim)} | ${finding.evidenceIds.map(shortId).join(', ')} | ${finding.confidence} | ${authorities} |`)
    }
  }
  lines.push('', `## ${w.markdownUnknowns}`, '')
  if (state.unknowns.length === 0) lines.push(w.markdownNone)
  else {
    lines.push(`| ${c.question} | ${c.severity} | ${c.status} |`, '|---|---|---|')
    for (const unknown of state.unknowns) lines.push(`| ${cell(unknown.question)} | ${unknown.severity || '-'} | ${unknown.status} |`)
  }
  // The findings cite short ids; here they are whole, so each one can be checked against rea.
  lines.push('', `## ${w.markdownEvidence}`, '')
  if (state.evidence.length === 0) lines.push(w.markdownNone)
  else {
    lines.push(`| ${c.operation} | ${c.confidence} | ${c.authority} | evidence_id |`, '|---|---|---|---|')
    for (const item of state.evidence) lines.push(`| ${cell(`${item.operation} ${item.detail}`.trim())} | ${item.confidence || '-'} | ${item.authority || '-'} | \`${item.id}\` |`)
  }
  return `${lines.join('\n')}\n`
}
