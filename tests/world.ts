// Just enough engine for the casebook: a clock, files, panes, tool registration, and a rea MCP
// server that answers with recorded results.

import { expect, mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'
import type { On, ToolCallResult } from 'claude-code'

export const SESSION = { cwd: 'D:\\cases', surface: 'desktop' as const, isInteractive: true }
export const PANE = 'rea-casebook'
export const FINDING_TOOL = 'mcp__rea-casebook__record_finding'

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
}

/**
 * A path as the world keys it. The engine hands paths over with the system's slashes and, off
 * Windows, makes a drive path relative (`/home/runner/…/D:\cases`): keep what starts at the drive letter.
 */
export const pathKey = (path: string) => path.replace(/\\/gu, '/').replace(/^.*?(?=[A-Za-z]:\/)/u, '')

export function world(on: On, files: Record<string, string> = {}): World {
  mock.env(on, {})
  mock.store(on)
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 12, 10, 0) })
  const w: World = { clock, files: new Map(Object.entries(files).map(([path, text]) => [pathKey(path), text])), opened: [], tools: [], commands: [], rea: {} }

  on('session.start', ($, e) => ({ cwd: e.cwd }))
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
  on('tool.check', () => ({ decision: 'allow' }))
  // Beneath the mod: the rea MCP server.
  on('tool.call', async ($, e) => {
    const tool = String(e.tool)
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
