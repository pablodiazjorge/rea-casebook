// rea-casebook: a pane with what rea delivered to the agent in this session: the target, the wait for
// Ghidra's cold start, the Evidence as it arrives, the open unknowns and the findings the model
// records with record_finding, a tool that refuses any evidence_id rea never delivered.
//
// It reads rea's results as they pass through `tool.call` (ADR 0015 of rea-lab) and never calls rea
// on its own, so it needs no permission beyond the person's own rules for rea. It calls no tool and
// submits no prompt by itself either. Each change rewrites the session's journal under
// ~/.rea-casebook/ (ADR 0016); `/casebook export` writes the casebook beside it as Markdown, and
// `/casebook artifact` writes a page beside it that the person asks Claude to publish (ADR 0017).
// Those three files are all it writes: nothing in the person's project, and no path anyone names.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput, ToolCallResult } from 'claude-code'

import type { CaseState } from '../types'
import { callEnded, callStarted, EMPTY_CASE, type FindingInput, type FindingOutcome, findingRefused, isQuick, oldestPending, recordFinding } from './casebook'
import { baseName, readReaResult, type ReaOutcome, savedText } from './evidence'
import { caseToHtml } from './html'
import { casebookBase, hasCase, journalLines } from './journal'
import { caseToMarkdown } from './markdown'
import { clip, formatSeconds, type Lang, langOf, words } from './messages'

const PANE = 'rea-casebook'
const VERSION = '1.0.4'
const REA = /^mcp__rea__/u
const FINDING_TOOL = 'mcp__rea-casebook__record_finding'
const TIMELINE_MAX = 40

const casebook = atom({ plugin: 'rea-casebook', key: 'case' } as const, EMPTY_CASE)
const now = atom({ plugin: 'rea-casebook', key: 'now' } as const, 0)

let lang: Lang = 'en'
// Opens the pane by itself once, at the first binary; reset on a reload, which is harmless.
let isAutoOpened = false
// Journal writes run one after another, so an older casebook never overwrites a newer one.
let journalQueue: Promise<void> = Promise.resolve()
// The page `/casebook artifact` last wrote: an Artifact publish of this file is the casebook's.
let artifactPage: string | null = null

// ---------------------------------------------------------------------------
// Engine helpers

/** A result too large for the client lands in a file; the Evidence is read from there. */
async function readSaved($: EngineInterface, tool: string, path: string, at: number): Promise<ReaOutcome> {
  try {
    const raw = await $.fs.read(path)
    return typeof raw === 'string' ? readReaResult(tool, savedText(raw), false, at) : { kind: 'other' }
  } catch {
    return { kind: 'other' }
  }
}

async function openPane($: EngineInterface): Promise<void> {
  await $.ui.open({ id: PANE, title: words(lang).name })
}

/** The home folder, read only from USERPROFILE (Windows) or HOME (macOS and Linux). */
async function homeOf($: EngineInterface): Promise<string> {
  return (await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || ''
}

/** This session's files under ~/.rea-casebook/, without extension, or null before a rea call. */
async function sessionBase($: EngineInterface, state: CaseState): Promise<string | null> {
  const home = await homeOf($)
  if (!home || state.startedAt === null) return null
  return casebookBase(home, await $.session.id(), state.startedAt)
}

async function writeJournal($: EngineInterface): Promise<void> {
  const state = await read($, casebook)
  if (!hasCase(state)) return
  const base = await sessionBase($, state)
  if (base) await $.fs.write(`${base}.jsonl`, journalLines(state, await $.session.id(), VERSION))
}

/** Queues a rewrite of the journal; a failed write never reaches rea or the model. */
function saveJournal($: EngineInterface): void {
  journalQueue = journalQueue.then(() => writeJournal($)).catch(() => undefined)
}

const failed = (result: ToolCallResult) => result.deny !== undefined || result.isError === true

/** The artifact URL in an Artifact result: its own field, or the first claude.ai link in its text. */
function artifactUrlOf(result: ToolCallResult): string | null {
  const own = (result.result as { url?: unknown } | undefined)?.url
  if (typeof own === 'string' && own.startsWith('https://')) return own
  return /https:\/\/claude\.ai\/[^\s"'<>)]+/u.exec(result.text ?? '')?.[0] ?? null
}

const samePath = (left: string, right: string) => left.replace(/\\/gu, '/').toLowerCase() === right.replace(/\\/gu, '/').toLowerCase()

async function keepArtifactUrl($: EngineInterface, url: string): Promise<void> {
  await update($, casebook, (state) => ({ ...state, artifactUrl: url }))
  saveJournal($)
}

/**
 * Writes the casebook page and answers with the request to give Claude. The mod never publishes it
 * itself: the person asks Claude, in a turn where their permissions decide as for any other call.
 * Once Claude has published the page, the request names that artifact so it is updated in place.
 */
async function writeArtifactPage($: EngineInterface): Promise<string> {
  const t = words(lang)
  const state = await read($, casebook)
  if (!hasCase(state)) return t.caseEmpty
  const base = await sessionBase($, state)
  if (!base) return t.exportFailed('~/.rea-casebook')
  const page = `${base}.html`
  try {
    await $.fs.write(page, caseToHtml(state, lang, VERSION))
  } catch {
    return t.exportFailed(page)
  }
  artifactPage = page
  const target = state.target ? baseName(state.target.path) : '-'
  return t.artifactWritten(page, t.artifactRequest(page, state.artifactUrl, t.artifactDescription(target)))
}

/** Writes the Markdown export beside the journal, `~/.rea-casebook/<day>/<session>.md`, and answers. */
async function exportCase($: EngineInterface): Promise<string> {
  const t = words(lang)
  const state = await read($, casebook)
  if (!hasCase(state)) return t.caseEmpty
  const base = await sessionBase($, state)
  if (!base) return t.exportFailed('~/.rea-casebook')
  try {
    await $.fs.write(`${base}.md`, caseToMarkdown(state, lang))
    return t.exported(`${base}.md`)
  } catch {
    return t.exportFailed(`${base}.md`)
  }
}

// ---------------------------------------------------------------------------
// Drawing

// Every word is drawn in the theme's `text` color, named on each Text: the only color with a 7:1
// contrast in every theme. Text left uncolored, or dimmed, does not follow the theme in the terminal
// (light gray on a light theme), so neither is used. Hierarchy comes from bold and spacing.
const WORDS = 'text'
// One mark per confidence, told apart by shape as well as color. A mutation record (no confidence)
// gets a hollow diamond in the text color.
const MARKS = {
  observed: { icon: '●', color: 'success' },
  derived: { icon: '◐', color: 'suggestion' },
  inferred: { icon: '○', color: 'warning' },
} as const
const markOf = (confidence: string) => MARKS[confidence as keyof typeof MARKS] ?? { icon: '◇', color: WORDS }
// Static analysis reads the binary itself; only another authority is worth a word on each line.
const USUAL_AUTHORITY = 'shipped-artifact'

async function drawPane($: EngineInterface, e: RenderInput, columns: number) {
  const { Box, Text } = $.ui.resolve(e)
  const t = words(lang)
  const state: CaseState = await read($, casebook)
  const at = Math.max(await read($, now), await $.clock.now())
  const waiting = oldestPending(state)
  const open = state.unknowns.filter((unknown) => unknown.status !== 'resolved')
  const timeline = state.evidence.slice(-TIMELINE_MAX).reverse()
  // Findings and questions take two lines at most, so the Evidence stays in view; the export has them whole.
  const twoLines = Math.max(40, columns * 2 - 12)

  return (
    <Box flexDirection="column">
      <Text color={WORDS} bold wrap="truncate-end">
        {state.target ? t.target(baseName(state.target.path), state.target.format, state.target.architecture) : t.noTarget}
      </Text>
      {waiting ? (
        <Text color={WORDS} wrap="wrap">
          <Text color="warning">{'◷ '}</Text>
          {(state.coldStartMs === null && !isQuick(waiting.tool) ? t.ghidraWaiting : t.waiting)(waiting.tool, formatSeconds(at - waiting.since))}
        </Text>
      ) : null}
      {state.coldStartMs !== null ? <Text color={WORDS}>{t.coldStart(formatSeconds(state.coldStartMs))}</Text> : null}

      <Box flexDirection="column" marginTop={1}>
        <Text color={WORDS} bold>{t.findings(state.findings.length)}</Text>
        {state.findings.length === 0 ? <Text color={WORDS}>{t.noFindings}</Text> : null}
        {state.findings.map((finding) => {
          const mark = markOf(finding.confidence)
          const tail = ` (${finding.evidenceIds.length} ev)`
          return (
            <Text key={finding.id} color={WORDS} wrap="wrap">
              <Text color={WORDS} bold>{`${finding.id} `}</Text>
              <Text color={mark.color}>{`${mark.icon} `}</Text>
              {`${clip(finding.claim, twoLines - finding.id.length - 3 - tail.length)}${tail}`}
            </Text>
          )
        })}
        {state.refused > 0 ? (
          <Text color={WORDS} wrap="wrap">
            <Text color="error">{'✕ '}</Text>
            {t.refused(state.refused)}
          </Text>
        ) : null}
      </Box>

      {open.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={WORDS} bold>{t.unknowns(open.length)}</Text>
          {open.map((unknown) => (
            <Text key={unknown.id} color={WORDS} wrap="wrap">
              <Text color="warning">{'? '}</Text>
              {`${clip(unknown.question, twoLines - 2)}${unknown.status && unknown.status !== 'open' ? ` [${unknown.status}]` : ''}`}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Text color={WORDS} bold>{t.timeline(state.evidence.length)}</Text>
        {timeline.length === 0 ? <Text color={WORDS}>{t.noEvidence}</Text> : null}
        {timeline.map((item) => {
          const mark = markOf(item.confidence)
          const authority = item.authority && item.authority !== USUAL_AUTHORITY ? ` - ${item.authority}` : ''
          return (
            <Text key={item.id} color={WORDS} wrap="truncate-end">
              <Text color={mark.color}>{`${mark.icon} `}</Text>
              {`${`${item.operation} ${item.detail}`.trim()}${authority}`}
            </Text>
          )
        })}
      </Box>

      {/* The marks' legend, once there is something to read it against, and the version drawing the pane. */}
      <Box flexDirection="column" marginTop={1}>
        {state.evidence.length > 0 ? (
          <Text color={WORDS}>
            <Text color={MARKS.observed.color}>{`${MARKS.observed.icon} `}</Text>
            {`${t.confidence.observed}   `}
            <Text color={MARKS.derived.color}>{`${MARKS.derived.icon} `}</Text>
            {`${t.confidence.derived}   `}
            <Text color={MARKS.inferred.color}>{`${MARKS.inferred.icon} `}</Text>
            {t.confidence.inferred}
          </Text>
        ) : null}
        <Text color={WORDS}>{`rea-casebook v${VERSION}`}</Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Hooks

export const register: Register = (on, options) => {
  lang = langOf(options?.language)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const t = words(lang)
    await $.tool.register({
      name: 'record_finding',
      description: t.toolDescription,
      inputSchema: {
        type: 'object',
        properties: {
          claim: { type: 'string', description: t.claimField },
          evidence_ids: { type: 'array', minItems: 1, items: { type: 'string', pattern: '^ev_[0-9a-f]{64}$' }, description: t.evidenceField },
          confidence: { type: 'string', enum: ['observed', 'derived', 'inferred'], description: t.confidenceField },
        },
        required: ['claim', 'evidence_ids'],
      },
      isDeferred: false,
    })
    await $.command.register({ name: 'casebook', description: t.command })

    // Ticks the Ghidra counter while a rea call runs; quiet otherwise.
    $.clock.every(1000, () => {
      void (async () => {
        if ((await read($, casebook)).pending.length === 0) return
        const at = await $.clock.now()
        await update($, now, () => at)
      })()
    })
    return started
  })

  // Every rea call: note the start, let it run, read what came back. The result goes back untouched.
  on('tool.call', { tool: REA }, async ($, e, next) => {
    const tool = e.tool.replace(REA, '')
    const id = e.tool_use_id
    const since = await $.clock.now()
    await update($, casebook, (state) => callStarted(state, id, tool, since))
    let ran: Awaited<ReturnType<typeof next>>
    try {
      ran = await next(e)
    } catch (error) {
      const at = await $.clock.now()
      await update($, casebook, (state) => callEnded(state, id, tool, { kind: 'error', message: String(error) }, at))
      throw error
    }
    try {
      const at = await $.clock.now()
      const text = ran.text ?? (typeof ran.result === 'string' ? ran.result : '')
      let outcome = readReaResult(tool, text, ran.isError === true, at)
      if (outcome.kind === 'saved') outcome = await readSaved($, tool, outcome.path, at)
      await update($, casebook, (state) => callEnded(state, id, tool, outcome, at))
      saveJournal($)
      if (outcome.kind === 'opened' && !isAutoOpened) {
        isAutoOpened = true
        void openPane($)
      }
    } catch {
      // The casebook never stands between rea and the agent.
    }
    return ran
  }).catch(($, e, next) => next(e)) // a failure here never refuses a rea call, nor runs it twice

  // The model's findings. When the hook fails, the .catch refuses with a reason instead of no answer.
  on('tool.call', { tool: FINDING_TOOL }, async ($, e) => {
    const t = words(lang)
    const at = await $.clock.now()
    const input = e as unknown as FindingInput
    let outcome: FindingOutcome = { ok: false, reason: 'invalid', problems: [] }
    await update($, casebook, (state) => {
      outcome = recordFinding(state, input, at)
      if (outcome.ok) return outcome.state
      return outcome.reason === 'unknown_evidence' ? findingRefused(state) : state
    })
    const result = outcome as FindingOutcome
    if (result.ok || result.reason === 'unknown_evidence') saveJournal($)
    if (result.ok) return { result: t.findingRecorded(result.finding.id) }
    return { deny: result.reason === 'unknown_evidence' ? t.unknownEvidence(result.missing) : t.invalidFinding(result.problems) }
  }).catch(() => ({ deny: words(lang).findingFailed }))

  on('command.run', { command: 'casebook' }, async ($, e) => {
    const t = words(lang)
    const [verb = '', ...rest] = e.args.trim().split(/\s+/u)
    if (verb === '') {
      await openPane($)
      return { text: t.opened }
    }
    if (verb === 'export' && rest.length === 0) return { text: await exportCase($) }
    if (verb === 'artifact' && rest.length === 0) return { text: await writeArtifactPage($) }
    return { text: t.usage }
  })

  // When Claude publishes the casebook's page (because the person asked it to, with the request
  // `/casebook artifact` gave), keep the URL so the next request names the same artifact. This only
  // reads the result: any Artifact call, this one included, passes through untouched.
  on('tool.call', { tool: 'Artifact' }, async ($, e, next) => {
    const ran = await next(e)
    try {
      const input = e as unknown as { action?: unknown; asset?: unknown; file_path?: unknown }
      const isPagePublish = (input.action === undefined || input.action === 'publish') && input.asset !== true
      if (isPagePublish && typeof input.file_path === 'string' && artifactPage && samePath(input.file_path, artifactPage) && !failed(ran)) {
        const url = artifactUrlOf(ran)
        if (url) await keepArtifactUrl($, url)
      }
    } catch {
      // Watching never changes what the Artifact call returns.
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => drawPane($, e, e.props.bodyColumns))
}
