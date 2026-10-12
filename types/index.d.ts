// The casebook's state: what rea delivered to the agent in this session, as the pane draws it.

/** One Evidence record rea delivered, reduced to what the pane shows. */
export type EvidenceItem = {
  id: string
  operation: string
  confidence: string
  authority: string
  /** The call's main parameters, for example "procedure=0x140001470". */
  detail: string
  limitations: number
  at: number
}

/** The binary the agent opened with open_binary. */
export type Target = { path: string; sha256: string; format: string; architecture: string }

/** A residual unknown rea recorded with record_unknown or update_unknown. */
export type Unknown = { id: string; question: string; status: string; severity: string; at: number }

/** A finding the model recorded with record_finding; it cites only delivered Evidence. */
export type Finding = { id: string; claim: string; evidenceIds: string[]; confidence: string; at: number }

/** A rea call still running, so the pane can count Ghidra's cold start. */
export type Pending = { id: string; tool: string; since: number }

export type CaseState = {
  target: Target | null
  pending: Pending[]
  /** Duration of the first call that had to wait for Ghidra to import and analyse the target. */
  coldStartMs: number | null
  evidence: EvidenceItem[]
  unknowns: Unknown[]
  findings: Finding[]
  /** record_finding calls refused because they cited evidence rea never delivered. */
  refused: number
}

declare module 'claude-code' {
  interface PluginState {
    'rea-casebook': { case: CaseState; now: number }
  }
}
