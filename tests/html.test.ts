import { describe, expect, test } from 'claude-code/testing'

import { EMPTY_CASE } from '../hooks/casebook'
import { caseToHtml } from '../hooks/html'
import type { CaseState } from '../types'

const ID = `ev_${'a'.repeat(64)}`

const CASE: CaseState = {
  ...EMPTY_CASE,
  target: { path: 'D:\\cases\\target.exe', sha256: 'c'.repeat(64), format: 'pe', architecture: 'x86_64' },
  coldStartMs: 18_000,
  evidence: [{ id: ID, operation: 'search_strings', confidence: 'observed', authority: 'shipped-artifact', detail: 'pattern=<ACCESS>', limitations: 0, at: 1 }],
  unknowns: [{ id: 'unk_1', question: 'Which "routine" checks it?', status: 'open', severity: 'low', at: 2 }],
  findings: [{ id: 'F1', claim: 'It prints <script>alert(1)</script> & stops.', evidenceIds: [ID], confidence: 'derived', at: 3 }],
}

describe('the artifact page', () => {
  test('is one self-contained page with a short title, light and dark themes, and no local path', () => {
    const html = caseToHtml(CASE, 'en', '0.2.0')
    // The artifact service adds the document skeleton: the page starts at its title and style.
    expect(html.startsWith('<title>Casebook target.exe</title>\n<style>')).toBe(true)
    expect(html).not.toMatch(/<!doctype|<html|<head|<body/iu)
    expect(html).toContain('<main lang="en">')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain(':root[data-theme="dark"]')
    expect(html).not.toMatch(/<script|<link|https?:\/\//u)
    expect(html).not.toContain('D:\\cases')
    expect(html).toContain('Exported by rea-casebook 0.2.0.')
  })

  test('escapes what the model and rea wrote, and keeps every evidence_id whole', () => {
    const html = caseToHtml(CASE, 'en', '0.2.0')
    expect(html).toContain('It prints &lt;script&gt;alert(1)&lt;/script&gt; &amp; stops.')
    expect(html).toContain('search_strings pattern=&lt;ACCESS&gt;')
    expect(html).toContain('Which &quot;routine&quot; checks it?')
    expect(html).toContain(`<code>${ID}</code>`)
    expect(html).toContain(`<code title="${ID}">${ID.slice(0, 19)}</code>`)
    expect(html).toContain('<span class="mark derived" aria-hidden="true">◐</span> derived')
  })

  test('an empty case says so in each section, in Spanish too', () => {
    const html = caseToHtml(EMPTY_CASE, 'es', '0.2.0')
    expect(html).toContain('<main lang="es">')
    expect(html.match(/<p class="muted">Ninguno\.<\/p>/gu)).toHaveLength(3)
    expect(html).toContain('Exportado por rea-casebook 0.2.0.')
  })
})
