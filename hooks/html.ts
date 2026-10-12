// The casebook as one self-contained HTML page, for `/casebook artifact` (ADR 0017 of rea-lab): the
// same sections as the Markdown export, with light and dark themes. Every color keeps a 7:1 contrast
// on its background, the marks included, and no local path is written. The artifact service wraps
// the page in its own document skeleton, so the page starts at its <title> and <style>, with no
// doctype, html, head or body of its own. No `$`: tested directly.

import type { CaseState } from '../types'
import { formatSeconds, words, type Lang } from './messages'

const escape = (value: string) =>
  value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')

const shortId = (id: string) => `<code title="${escape(id)}">${escape(id.slice(0, 19))}</code>`

const MARKS: Record<string, string> = { observed: '●', derived: '◐', inferred: '○' }

const STYLE = `
:root { --bg: #ffffff; --surface: #f6f8fa; --text: #111111; --muted: #3d3d3d; --line: #d0d7de; --code: #eef1f4;
  --observed: #116329; --derived: #0a3d91; --inferred: #7a4b00; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #0d1117; --surface: #161b22; --text: #f0f3f6; --muted: #c9d1d9; --line: #30363d;
    --code: #1f2630; --observed: #56d364; --derived: #79c0ff; --inferred: #e3b341; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #0d1117; --surface: #161b22; --text: #f0f3f6; --muted: #c9d1d9; --line: #30363d;
  --code: #1f2630; --observed: #56d364; --derived: #79c0ff; --inferred: #e3b341; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1040px; margin: 0 auto; padding-inline: 16px; padding-block: 24px 48px; }
h1 { font-size: 1.6rem; margin: 0 0 6px; }
h2 { font-size: 1.15rem; margin: 32px 0 10px; }
p { margin: 0 0 6px; }
.muted { color: var(--muted); }
.table { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; min-width: 680px; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
th { background: var(--surface); font-weight: 600; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
code { font: 0.85rem/1.4 ui-monospace, "Cascadia Mono", Consolas, monospace; background: var(--code); padding: 1px 4px; border-radius: 4px; overflow-wrap: anywhere; }
.mark { font-weight: 700; }
.observed { color: var(--observed); } .derived { color: var(--derived); } .inferred { color: var(--inferred); }
.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 12px; color: var(--muted); }
footer { margin-top: 32px; color: var(--muted); font-size: 0.9rem; }
`

export function caseToHtml(state: CaseState, lang: Lang, version: string): string {
  const w = words(lang)
  const c = w.markdownColumns
  const target = state.target?.path.split(/[\\/]/u).pop() ?? '-'
  const confidence = (value: string) => {
    const name = w.confidence[value as keyof typeof w.confidence]
    return name ? `<span class="mark ${value}" aria-hidden="true">${MARKS[value]}</span> ${escape(name)}` : '-'
  }
  const authorityOf = new Map(state.evidence.map((item) => [item.id, item.authority]))
  const none = `<p class="muted">${escape(w.markdownNone)}</p>`
  const table = (head: string[], rows: string[][]) =>
    `<div class="table"><table><thead><tr>${head.map((cell) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div>`

  const sections: string[] = [`<h1>${escape(w.markdownTitle(target))}</h1>`, `<p class="muted">${escape(w.htmlIntro)}</p>`]
  if (state.target) {
    sections.push(
      `<p>${escape(`${state.target.format} ${state.target.architecture}`)} - SHA-256 <code>${escape(state.target.sha256)}</code></p>`,
      state.coldStartMs !== null ? `<p class="muted">${escape(w.coldStart(formatSeconds(state.coldStartMs)))}</p>` : '',
    )
  }
  sections.push(`<h2>${escape(w.markdownFindings)}</h2>`)
  sections.push(
    state.findings.length === 0
      ? none
      : table(
          ['#', c.confidence, c.finding, c.evidence, c.authority],
          state.findings.map((finding) => [
            `<strong>${escape(finding.id)}</strong>`,
            confidence(finding.confidence),
            escape(finding.claim),
            finding.evidenceIds.map(shortId).join(' '),
            escape([...new Set(finding.evidenceIds.map((id) => authorityOf.get(id) || '-'))].join(', ')),
          ]),
        ),
  )
  sections.push(`<h2>${escape(w.markdownUnknowns)}</h2>`)
  sections.push(
    state.unknowns.length === 0
      ? none
      : table(
          [c.question, c.severity, c.status],
          state.unknowns.map((unknown) => [escape(unknown.question), escape(unknown.severity || '-'), escape(unknown.status)]),
        ),
  )
  sections.push(`<h2>${escape(w.markdownEvidence)}</h2>`)
  sections.push(
    state.evidence.length === 0
      ? none
      : table(
          [c.confidence, c.operation, c.authority, 'evidence_id'],
          state.evidence.map((item) => [
            confidence(item.confidence),
            escape(`${item.operation} ${item.detail}`.trim()),
            escape(item.authority || '-'),
            `<code>${escape(item.id)}</code>`,
          ]),
        ),
  )
  sections.push(
    `<div class="legend">${(['observed', 'derived', 'inferred'] as const).map((value) => `<span>${confidence(value)}</span>`).join('')}</div>`,
    `<footer>${escape(w.htmlFooter(version))}</footer>`,
  )

  return [
    `<title>${escape(w.htmlTitle(target))}</title>`,
    `<style>${STYLE}</style>`,
    `<main lang="${lang}">${sections.filter(Boolean).join('\n')}</main>`,
    '',
  ].join('\n')
}
