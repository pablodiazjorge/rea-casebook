import { describe, expect, test } from 'claude-code/testing'

import { words } from '../hooks/messages'
import { closeBinary, inputError, openBinary, pseudoCode, recordUnknown, searchStrings } from './fixtures/rea'
import { ARTIFACT_URL, CASEBOOK_FOLDER, command, finding, JOURNAL, MARKDOWN, PAGE, PANE, PANE_PROPS, rea, SESSION, until, world } from './world'

const idOf = (text: string) => String((JSON.parse(text) as { evidence_id: string }).evidence_id)
const mutationOf = (text: string) => String((JSON.parse(text) as { result: { mutation_evidence_ids: string[] } }).result.mutation_evidence_ids[0])
const FOREIGN = `ev_${'0'.repeat(64)}`

describe('rea-casebook', () => {
  test('registers record_finding in the prompt (not behind ToolSearch) and /casebook', async ($, on) => {
    const w = world(on)
    await $.session.start(SESSION)
    expect(w.tools).toEqual([{ name: 'record_finding', isDeferred: false }])
    expect(w.commands).toEqual(['casebook'])
  })

  test('follows a rea session: target, Evidence, and the agent gets each result untouched', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, search_strings: { text: searchStrings } }
    await $.session.start(SESSION)

    const opened = await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    expect(opened.text).toBe(openBinary)
    // The first binary opens the pane once.
    await until(w.clock, () => w.opened.length === 1)
    expect(w.opened).toEqual([PANE])

    const found = await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))
    expect(found.text).toBe(searchStrings)

    const pane = await $.ui.mount({ plugin: 'rea-casebook', surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await pane.find({ type: 'Text', text: 'target.exe - pe x86_64' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Evidence (1)' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'search_strings pattern=ACCESS mode=literal' })).toBeDefined()
    // A mark per confidence, and no authority word when it is the binary itself.
    expect(await pane.find({ type: 'Text', text: '● ' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: ' - shipped-artifact' })).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: 'rea-casebook v1.0.4' })).toBeDefined()
    // Contrast: every Text names a theme color and none is dimmed, so the words follow light and
    // dark themes alike; uncolored or dimmed text came out light gray on a light terminal.
    const texts = await pane.findAll({ type: 'Text' })
    expect(texts.length).toBeGreaterThan(5)
    for (const text of texts) {
      expect(text.props.color).toBeDefined()
      expect(text.props.dimColor).toBeFalsy()
    }
    await pane.unmount()
  })

  test('names the authority on a line only when it is not the binary itself', async ($, on) => {
    const w = world(on)
    const replayed = JSON.stringify({ ...(JSON.parse(searchStrings) as Record<string, unknown>), authority: 'controlled-replay', confidence: 'inferred' })
    w.rea = { search_strings: { text: replayed } }
    await $.session.start(SESSION)
    await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))
    const pane = await $.ui.mount({ plugin: 'rea-casebook', surface: 'terminal', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await pane.find({ type: 'Text', text: 'search_strings pattern=ACCESS mode=literal - controlled-replay' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '○ ' })).toBeDefined()
    await pane.unmount()
  })

  test('counts the wait for the first Ghidra query and keeps it as the cold start', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, procedure_pseudo_code: { text: pseudoCode, delayMs: 42_000 } }
    await $.session.start(SESSION)
    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))

    const pending = $.tool.call(rea('procedure_pseudo_code', { procedure: '0x140001020' }))
    await w.clock.advance(10_000)
    const waiting = await $.ui.mount({ plugin: 'rea-casebook', surface: 'terminal', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await waiting.find({ type: 'Text', text: words('en').ghidraWaiting('procedure_pseudo_code', '10\u00a0s') })).toBeDefined()
    await waiting.unmount()

    await w.clock.advance(32_000)
    expect((await pending).text).toBe(pseudoCode)
    const done = await $.ui.mount({ plugin: 'rea-casebook', surface: 'terminal', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await done.find({ type: 'Text', text: 'Ghidra cold start: 42\u00a0s' })).toBeDefined()
    expect(await done.find({ type: 'Text', text: words('en').ghidraWaiting('procedure_pseudo_code', '10\u00a0s') })).toBeUndefined()
    await done.unmount()
  })

  test('records a finding that cites delivered Evidence and refuses one that cites any other id', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, search_strings: { text: searchStrings } }
    await $.session.start(SESSION)
    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))

    const recorded = await $.tool.call(finding({ claim: 'The success message is "ACCESS GRANTED".', evidence_ids: [idOf(searchStrings)], confidence: 'observed' }))
    expect(recorded.result).toBe('Recorded as F1 in the casebook.')

    const refused = await $.tool.call(finding({ claim: 'The key is 1234.', evidence_ids: [FOREIGN] }))
    expect(refused.deny).toBe(words('en').unknownEvidence([FOREIGN]))

    const invalid = await $.tool.call(finding({ claim: '', evidence_ids: ['not-an-id'], confidence: 'sure' }))
    expect(invalid.deny).toBe(words('en').invalidFinding(['claim', 'evidence_ids', 'confidence']))

    const pane = await $.ui.mount({ plugin: 'rea-casebook', surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await pane.find({ type: 'Text', text: 'Findings (1)' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'The success message is "ACCESS GRANTED". (1 ev)' })).toBeDefined()
    // Only the invented id counts as refused; a malformed call is the model's typo.
    expect(await pane.find({ type: 'Text', text: words('en').refused(1) })).toBeDefined()
    await pane.unmount()
  })

  test('shows the unknowns rea records and accepts their mutation Evidence as delivered', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, record_unknown: { text: recordUnknown } }
    await $.session.start(SESSION)
    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    await $.tool.call(rea('record_unknown', { question: 'Which routine validates the serial before the success message?' }))

    const pane = await $.ui.mount({ plugin: 'rea-casebook', surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await pane.find({ type: 'Text', text: 'Open unknowns (1)' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Which routine validates the serial before the success message?' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'record_unknown question=Which routine validates the serial…' })).toBeDefined()
    await pane.unmount()

    // In a narrow pane a long question takes two lines at most.
    const narrow = await $.ui.mount({ plugin: 'rea-casebook', surface: 'desktop', component: 'Pane', requestId: PANE, props: { ...PANE_PROPS, bodyColumns: 30 } })
    expect(await narrow.find({ type: 'Text', text: 'Which routine validates the serial before…' })).toBeDefined()
    await narrow.unmount()

    const recorded = await $.tool.call(finding({ claim: 'The validating routine is still unknown.', evidence_ids: [mutationOf(recordUnknown)], confidence: 'inferred' }))
    expect(recorded.result).toBe('Recorded as F1 in the casebook.')
  })

  test('reads a result the client saved to a file because it was too large', async ($, on) => {
    const saved = 'D:\\home\\.claude\\projects\\case\\tool-results\\mcp-rea-search_strings-1.txt'
    const w = world(on, { [saved]: JSON.stringify([{ type: 'text', text: searchStrings }]) })
    const note = `Error: result (61,234 tokens) exceeds maximum allowed tokens. Output has been saved to ${saved}.\nUse offset and limit parameters to read specific portions of the file.`
    w.rea = { search_strings: { text: note } }
    await $.session.start(SESSION)
    expect((await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))).text).toBe(note)

    const recorded = await $.tool.call(finding({ claim: 'The success message is "ACCESS GRANTED".', evidence_ids: [idOf(searchStrings)] }))
    expect(recorded.result).toBe('Recorded as F1 in the casebook.')
  })

  test('an input error from rea adds nothing and stops the wait', async ($, on) => {
    const w = world(on)
    w.rea = { search_strings: { text: inputError, isError: true }, close_binary: { text: closeBinary } }
    await $.session.start(SESSION)
    await $.tool.call(rea('search_strings', { query: 'ACCESS' }))
    await $.tool.call(rea('close_binary'))

    const pane = await $.ui.mount({ plugin: 'rea-casebook', surface: 'terminal', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await pane.find({ type: 'Text', text: 'Evidence (0)' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: words('en').noTarget })).toBeDefined()
    await pane.unmount()
  })

  test('/casebook opens the pane, exports the Markdown and explains its usage', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, search_strings: { text: searchStrings } }
    await $.session.start(SESSION)
    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))
    await $.tool.call(finding({ claim: 'The success message is "ACCESS GRANTED".', evidence_ids: [idOf(searchStrings)], confidence: 'observed' }))

    expect((await $.command.run(command())).text).toBe('Casebook pane opened.')
    // The export goes beside the journal, in the home folder, never into the project.
    expect((await $.command.run(command('export'))).text).toBe('Casebook exported to D:\\home\\tester\\.rea-casebook\\2026-10-12\\sess-1.md.')
    const markdown = w.files.get(MARKDOWN) ?? ''
    expect(markdown).toContain('# Casebook: target.exe')
    expect(markdown).toContain('| F1 | The success message is "ACCESS GRANTED". | `ev_f5061e3dcffd337c` | observed | shipped-artifact |')
    // The export names the target by its file name, never by its local path.
    expect(markdown).not.toContain('D:\\cases')

    // No path can be named: an argument only shows how to use the command, and nothing else is written.
    expect((await $.command.run(command('export notes\\case.md'))).text).toBe(words('en').usage)
    expect((await $.command.run(command('export CLAUDE.md'))).text).toBe(words('en').usage)
    expect((await $.command.run(command('publish'))).text).toBe(words('en').usage)
    await until(w.clock, () => w.files.has(JOURNAL))
    expect([...w.files.keys()].filter((path) => !path.startsWith(CASEBOOK_FOLDER))).toEqual([])
  })
})

describe('rea-casebook in Spanish', () => {
  test('with Language set to Español, the pane and the refusals Claude reads are in Spanish', { options: { language: 'Español' } }, async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, search_strings: { text: searchStrings } }
    await $.session.start(SESSION)
    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))

    const refused = await $.tool.call(finding({ claim: 'La clave es 1234.', evidence_ids: [FOREIGN] }))
    expect(refused.deny).toBe(words('es').unknownEvidence([FOREIGN]))

    const pane = await $.ui.mount({ plugin: 'rea-casebook', surface: 'desktop', component: 'Pane', requestId: PANE, props: PANE_PROPS })
    expect(await pane.find({ type: 'Text', text: 'Evidencia (1)' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Hallazgos (0)' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: words('es').refused(1) })).toBeDefined()
    await pane.unmount()
    expect((await $.command.run(command())).text).toBe('Panel del casebook abierto.')
  })
})

describe('rea-casebook journal and artifact', () => {
  const PAGE_PATH = 'D:\\home\\tester\\.rea-casebook\\2026-10-12\\sess-1.html'

  test('keeps a journal of the session in the home folder, and none before rea is used', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, search_strings: { text: searchStrings } }
    await $.session.start(SESSION)
    await $.command.run(command())
    expect(w.files.size).toBe(0)

    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))
    await $.tool.call(finding({ claim: 'The success message is "ACCESS GRANTED".', evidence_ids: [idOf(searchStrings)], confidence: 'observed' }))
    await until(w.clock, () => (w.files.get(JOURNAL) ?? '').includes('"type":"finding"'))

    const lines = (w.files.get(JOURNAL) ?? '').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(lines.map((line) => line.type)).toEqual(['casebook', 'target', 'evidence', 'finding'])
    expect(lines[0]).toMatchObject({ version: '1.0.4', session: 'sess-1', refused: 0, artifactUrl: null })
    // Nothing lands in the project: the journal is the only file written.
    expect([...w.files.keys()]).toEqual([JOURNAL])
  })

  test('/casebook artifact writes the page and gives the request for Claude, without calling a tool or submitting a prompt', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary }, search_strings: { text: searchStrings } }
    await $.session.start(SESSION)
    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    await $.tool.call(rea('search_strings', { pattern: 'ACCESS' }))

    const t = words('en')
    const request = t.artifactRequest(PAGE_PATH, null, t.artifactDescription('target.exe'))
    expect((await $.command.run(command('artifact'))).text).toBe(t.artifactWritten(PAGE_PATH, request))
    expect(request).toContain('as a new private artifact with the icon "search"')
    expect(w.files.get(PAGE)).toContain('<title>Casebook target.exe</title>')
    await w.clock.advance(1000)
    expect(w.artifactCalls).toEqual([])
    expect(w.prompts).toEqual([])
  })

  test('keeps the URL when Claude publishes the page, so the next request names the same artifact', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary } }
    await $.session.start(SESSION)
    await $.tool.call(rea('open_binary', { path: 'D:\\cases\\target.exe' }))
    await $.command.run(command('artifact'))

    // The person asks Claude, and Claude publishes the page; the mod only reads the result.
    const published = await $.tool.call({ tool: 'Artifact', tool_use_id: 'toolu_artifact', action: 'publish', file_path: PAGE_PATH, icon: 'search' } as never)
    expect(published.text).toBe(`Published ${ARTIFACT_URL}`)

    const t = words('en')
    const next = t.artifactRequest(PAGE_PATH, ARTIFACT_URL, t.artifactDescription('target.exe'))
    expect((await $.command.run(command('artifact'))).text).toBe(t.artifactWritten(PAGE_PATH, next))
    expect(next).toContain(`to my existing artifact ${ARTIFACT_URL}`)
    expect(w.artifactCalls).toHaveLength(1)
    expect(w.prompts).toEqual([])
  })

  test('says when there is nothing to export or publish yet, and how to use the command', async ($, on) => {
    const w = world(on)
    w.rea = { open_binary: { text: openBinary } }
    await $.session.start(SESSION)
    expect((await $.command.run(command('export'))).text).toBe(words('en').caseEmpty)
    expect((await $.command.run(command('artifact'))).text).toBe(words('en').caseEmpty)
    expect((await $.command.run(command('artifact now'))).text).toBe(words('en').usage)
    expect(w.files.size).toBe(0)
  })
})
