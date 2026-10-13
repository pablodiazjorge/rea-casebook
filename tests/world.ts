// Just enough engine for the casebook: a clock, a home folder, files, panes, tool registration, a rea
// MCP server that answers with recorded results, and an Artifact tool.

import { expect, mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'
import type { On, ToolCallResult } from 'claude-code'

export const SESSION = { cwd: 'D:\\cases', surface: 'desktop' as const, isInteractive: true }
export const SESSION_ID = 'sess-1'
export const HOME = 'D:\\home\\tester'
export const PANE = 'rea-casebook'
export const FINDING_TOOL = 'mcp__rea-casebook__record_finding'
export const ARTIFACT_URL = 'https://claude.ai/code/artifact/0c4b5e1d-casebook'
/** Where this world's session keeps its journal and page, as `pathKey` writes them. */
export const JOURNAL = 'D:/home/tester/.rea-casebook/2026-10-12/sess-1.jsonl'
export const PAGE = 'D:/home/tester/.rea-casebook/2026-10-12/sess-1.html'

export const PANE_PROPS = {
  title: 'Casebook',
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

export const command = (args = '') => ({
  command: 'casebook',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 120 },
})

/** How the fake rea answers one tool: the result text, an error flag and how long it takes. */
export type ReaAnswer = { text: string; isError?: boolean; delayMs?: number }

export type World = {
  clock: MockClock
  files: Map<string, string>
  opened: string[]
  tools: { name: string; isDeferred?: boolean }[]
  commands: string[]
  /** The rea answers by tool name (without mcp__rea__); a test may change them. */
  rea: Record<string, ReaAnswer>
  /** Every Artifact call, as the tool received it: the tests check that only Claude makes them. */
  artifactCalls: Record<string, unknown>[]
  /** The prompts submitted to Claude: the tests check that the mod submits none. */
  prompts: string[]
}

/**
 * A path as the world keys it. The engine hands paths over with the system's slashes and, off
 * Windows, makes a drive path relative (`/home/runner/…/D:\cases`): keep what starts at the drive letter.
 */
export const pathKey = (path: string) => path.replace(/\\/gu, '/').replace(/^.*?(?=[A-Za-z]:\/)/u, '')

export function world(on: On, files: Record<string, string> = {}): World {
  mock.env(on, { USERPROFILE: HOME })
  mock.store(on)
  const clock = mock.clock(on, { now: new Date(2026, 9, 12, 10, 0).getTime() })
  const w: World = {
    clock,
    files: new Map(Object.entries(files).map(([path, text]) => [pathKey(path), text])),
    opened: [],
    tools: [],
    commands: [],
    rea: {},
    artifactCalls: [],
    prompts: [],
  }

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: SESSION_ID }))
  on('tool.register', ($, e) => {
    w.tools.push({ name: e.name, isDeferred: e.isDeferred })
    return { value: { tool: `mcp__rea-casebook__${e.name}` } }
  })
  on('command.register', ($, e) => {
    w.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', ($, e) => {
    w.opened.push(e.id)
    return { value: { isPlaced: true } as never }
  })
  on('fs.read', ($, e) => {
    const text = w.files.get(pathKey(e.path))
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on('fs.write', ($, e) => {
    w.files.set(pathKey(e.path), e.text)
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    w.prompts.push(e.text)
    return { text: e.text }
  })
  // Beneath the mod: the Artifact tool and the rea MCP server.
  on('tool.call', async ($, e) => {
    const tool = String(e.tool)
    if (tool === 'Artifact') {
      const { tool: _tool, tool_use_id: _id, ...input } = e as unknown as Record<string, unknown>
      w.artifactCalls.push(input)
      return { result: { url: ARTIFACT_URL }, text: `Published ${ARTIFACT_URL}` } as unknown as ToolCallResult
    }
    const answer = tool.startsWith('mcp__rea__') ? w.rea[tool.slice('mcp__rea__'.length)] : undefined
    if (!answer) return { deny: `no such tool in this world: ${tool}` }
    if (answer.delayMs) await clock.sleep(answer.delayMs)
    return { result: answer.text, text: answer.text, ...(answer.isError ? { isError: true } : {}) } as unknown as ToolCallResult
  })
  return w
}

/** A call from the agent to a rea tool. */
export const rea = (tool: string, args: Record<string, unknown> = {}) => ({ tool: `mcp__rea__${tool}`, tool_use_id: `toolu_${tool}`, ...args }) as never

/** A call from the agent to record_finding. */
export const finding = (input: Record<string, unknown>) => ({ tool: FINDING_TOOL, tool_use_id: 'toolu_finding', ...input }) as never

/** Lets the hooks, which run alongside the test, get to where the test expects them. */
export async function until(clock: MockClock, condition: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !condition(); i++) await clock.settle()
  expect(condition()).toBe(true)
}
