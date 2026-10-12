# AGENTS.md

Instructions for coding agents working on rea-casebook. `.claude/CLAUDE.md` only imports this file: a `CLAUDE.md` at the plugin root would look like context shipped to the plugin's users, and it is not.

## What this repository is

A Claude Code mod (a plugin with function hooks) that collects the Evidence rea gives the agent into a pane, with a `record_finding` tool that refuses `evidence_id` values rea never delivered. The design decisions live in rea-lab's ADRs 0015 to 0017.

## Map

| Path | Content |
|---|---|
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Manifest and single-plugin marketplace |
| `types/index.d.ts` | The `$.state` contract: every value the mod keeps |
| `hooks/register.tsx` | The only module that uses `$`: hooks, pane, command and tool |
| `hooks/evidence.ts` | Reads a rea result (Evidence, target, unknowns, saved file, error) |
| `hooks/casebook.ts` | The casebook's state changes and the `record_finding` rule |
| `hooks/journal.ts` | The session journal under `~/.rea-casebook/` and its paths (ADR 0016) |
| `hooks/markdown.ts`, `hooks/html.ts` | The Markdown export and the artifact page (ADR 0017) |
| `hooks/messages.ts` | Every word in English and Spanish |
| `tests/` | Pure tests per module, `flow.test.ts` against `world.ts`, real rea results in `fixtures/rea.ts` |

## Commands

```bash
claude plugin validate .claude-plugin/plugin.json   # must pass
claude plugin test .                                # must pass
```

## Rules

- Agents never commit or push. Prepare the commit message (Conventional Commits, English) and let the author commit.
- English for code, comments, identifiers, commits, issues and pull requests. Only the READMEs are bilingual (`README.md` and `README.es.md`, same structure). Spanish follows the RAE, with no em dash and no middle dot as a separator.
- `$` is passed only to top-level functions of `register.tsx`. Logic that does not need the engine goes into a pure module with its own tests.
- The rea capture never changes what the agent receives and never refuses or repeats a rea call.
- The mod never calls rea on its own (`$.mcp.call` has no permission prompt; ADR 0015).
- Fixtures come from real rea results with local paths replaced. Never commit a path with a user name, an email or a token.
- When the mod changes, bump `version` in `plugin.json` and the `VERSION` shown in the pane footer together.
