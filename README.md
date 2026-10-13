<h1 align="center">rea-casebook</h1>

<p align="center">
  A Claude Code mod that keeps a live casebook of what <a href="https://github.com/morluto/rea">rea</a> gives the agent while it reverse engineers a binary
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-%E2%89%A5_2.1.296-D97757?logo=claude&logoColor=fff" alt="Claude Code 2.1.296 or newer">
  <img src="https://img.shields.io/badge/version-1.0.4-blue" alt="Version">
  <img src="https://img.shields.io/badge/type-mod-6f42c1" alt="Claude Code mod">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center"><a href="README.es.md">Leer en español</a></p>

![A Claude Code session in a dark theme: on the left, the agent analyses a challenge binary with rea and records findings with record_finding; on the right, the Casebook pane lists the target, a Ghidra cold start of 18 seconds, seven findings, two open unknowns and eighteen Evidence records](media/session-dark.png)

rea answers each analysis call with an Evidence record: an `evidence_id`, what was asked, how sure it is (observed, derived or inferred) and where it comes from. Those records live in rea's memory for as long as the MCP connection lasts, and in the transcript they scroll away among the model's text. rea-casebook collects them in a pane as they arrive, makes the wait for Ghidra visible, and gives the model a tool to record findings that **must cite Evidence rea actually delivered**.

It needs rea registered as an MCP server named `rea` (its tools appear as `mcp__rea__*`). It works with any binary rea opens; it was built on Windows with rea 6.4.0 and Ghidra 12.1.

## What the pane shows

| Section | What it holds |
|---|---|
| Target | The binary `open_binary` opened: file name, format and architecture |
| Wait | While a rea call runs, how long it has been waiting. The first Ghidra-backed query imports and analyses the target and can take minutes; the pane says so |
| Cold start | How long that first query took, kept for the session |
| Findings | What the model recorded with `record_finding`, each with a mark for its confidence and the number of Evidence records it cites, plus how many were refused |
| Open unknowns | The questions rea holds as residual unknowns (`record_unknown`, `update_unknown`, `list_unknowns`) until they are resolved |
| Evidence | The latest records, newest first: a mark for the confidence, the operation and its main parameters, and the authority when it is not the binary itself |

Confidence is drawn as a mark that differs in shape as well as color: ● observed, ◐ derived, ○ inferred (a legend sits at the bottom of the pane). Long findings and questions take two lines at most; the export keeps them whole. The words stay in the theme's text color, and color goes to the marks.

![The pane in a light theme at the end of the session: findings F1 to F7 marked observed or derived with their Evidence count, two open unknowns, the Evidence list newest first and the legend of the marks](media/casebook-light.png)
![The same pane in a dark theme](media/casebook-dark.png)

![The pane while the first Ghidra query runs: waiting for binary_overview for 7 seconds, with a note that the first query imports and analyses the target](media/waiting-dark.png)

The pane opens by itself the first time the agent opens a binary, and `/casebook` opens it again. A footer names the mod's version, so you know which code is drawing.

## Findings that cite real Evidence

The mod adds one tool for the model, `record_finding`, with a claim, the `evidence_id` values that support it and a confidence (`observed`, `derived` or `inferred`). It records the finding only when every cited id came from a rea result in this session. An invented id, or one copied from another session, is refused, and the model reads which ids rea never delivered, so it can go back and get real Evidence. The refusals are counted in the pane.

The ids of the mutation Evidence that `record_unknown` and `update_unknown` return count as delivered too: "this is still unknown" is a finding that can cite them.

## How it works

1. Every call to a rea tool passes through a `tool.call` hook. The mod notes when it started, lets it run and reads the result the agent gets: an Evidence record, the target of `open_binary`, the unknowns of the session tools, or an error. The agent's result goes back untouched, and a failure inside the mod never refuses or repeats a rea call.
2. When a result is too large for the client and is saved to a file, the mod reads the Evidence from that file.
3. The mod never calls rea on its own. Everything it shows is what the agent already received.
4. The state lives in the session (`$.state`) and is drawn by the pane. A second `open_binary` keeps the Evidence of the first, so comparing two builds keeps both.
5. Each change rewrites the session's journal, `~/.rea-casebook/<date>/<session>.jsonl`: a line for the session and its counters, one for the target with its file name and SHA-256 (never its local path), and one per Evidence record, unknown and finding, in the order they happened. The journal and both exports stay in that folder; the casebook only leaves it when you ask Claude to publish the artifact page.

## The command

| Command | What it does |
|---|---|
| `/casebook` | Opens the pane |
| `/casebook export` | Writes the casebook as Markdown beside the journal, to `~/.rea-casebook/<date>/<session>.md` |
| `/casebook artifact` | Writes the casebook as a page and gives you the request to ask Claude to publish it as a private claude.ai artifact; once it is published, the request names the same artifact |

The export has the target (name, format, architecture and SHA-256), the cold start, the findings with their Evidence, confidence and authority, the open unknowns and the Evidence list. It names the target by its file name, never by its local path. The command takes no file name: the export always goes to that one place.

The artifact is a page with the same sections, in light and dark themes, with every `evidence_id` whole. The mod writes it next to the journal and answers with a request for you to give Claude, such as `Publish <page> with the Artifact tool as a new private artifact …`. Claude then publishes it in a visible turn, where you decide as for any other call. Once Claude has published it, the next request names that artifact, so it is updated in place. Publishing needs a session that offers the Artifact tool, such as the Claude desktop app.

## Language

In `/config`, under rea-casebook, **Language** is `English` (the default) or `Español`. It sets the pane, the export and what Claude reads when a finding is refused. The tool's description stays in English, the language the model reads best.

## Permissions

The pane needs no rules: the mod reads the results of rea calls that your own rules already allowed, and calls nothing by itself.

`record_finding` is called by the model, so it goes through your permissions like any other tool: Claude Code may ask you each time, or the classifier may decide in auto mode. It only writes to the pane, so it is worth allowing in `.claude/settings.json` (the project's) or `~/.claude/settings.json`.

When Claude publishes the artifact for you, it first reads the page the mod wrote under `~/.rea-casebook/`, outside your project, and Claude Code asks about that read. The second rule below allows reads of that folder only, so the publish does not stop there:

```json
{
  "permissions": {
    "allow": ["mcp__rea-casebook__record_finding", "Read(~/.rea-casebook/**)"]
  }
}
```

The mod writes files through the engine, not through your rules: the journal under `~/.rea-casebook/` after each change, and the Markdown export and the artifact page beside it when you ask for them. `/casebook artifact` never publishes by itself: Claude makes the Artifact call when you ask it to, and your rules apply.

## What it runs, writes and sends

Everything the mod does on its own, for anyone who reviews it before installing.

### What the hooks do

| Hook | What it does |
|---|---|
| `tool.call` on rea's tools (`mcp__rea__*`) | Reads each result to update the casebook and returns what `next` gives back, unchanged. It never refuses, repeats or rewrites a rea call |
| `tool.call` on `Artifact` | When a call publishes the casebook page, reads the artifact URL from its result. It returns what `next` gives back, unchanged, for every Artifact call |
| `tool.call` on `mcp__rea-casebook__record_finding` | Stands in for one tool only, the mod's own `record_finding`, on every call: this hook is that tool's implementation, so it answers without `next`. It records the finding or refuses it, as described above. It stands in for no other tool |
| `command.run` on `/casebook` | Opens the pane or writes one of the two exports |
| `ui.render` on the pane | Draws the casebook |
| `session.start` | Registers `record_finding`, the command and a one-second timer that only redraws the waiting counter |

### What the mod writes

It writes exactly three files, all in one folder under your home folder, `~/.rea-casebook/<date>/`, named after the session and with a fixed extension:

| File | When |
|---|---|
| `<session>.jsonl`, the journal | After each change to the casebook |
| `<session>.md`, the Markdown export | When you run `/casebook export` |
| `<session>.html`, the artifact page | When you run `/casebook artifact` |

No command takes a path, and the session id in the name is cut to letters, digits, `_` and `-`, so a file never lands outside that folder. The mod writes nothing in your project, and it never writes or edits a build, start-up, settings or instructions file.

### What it reads, calls and sends

- **What it reads.** The results of the rea calls the agent already made, and a rea result that the client saved to a file because it was too large. It also reads the environment variable `USERPROFILE` (Windows) or `HOME` (macOS and Linux), only to find your home folder for the three files above, because the engine gives a mod no other way to find it. Neither variable is a credential, and the mod reads no token, key or password.
- **Tools it calls by itself.** None. It never calls rea, Artifact or any other tool; `record_finding` is called by the model.
- **Prompts it submits.** None. `/casebook artifact` shows you a request to give Claude; it does not send it.
- **Network.** None. The only data that leaves your machine is the artifact page you ask Claude to publish, through Claude Code's Artifact tool.

[PRIVACY.md](PRIVACY.md) sums this up as a privacy notice.

## Install

Inside a Claude Code session:

```text
/plugin install rea-casebook --marketplace pablodiazjorge/rea-casebook
```

Or in a terminal:

```bash
claude plugin marketplace add pablodiazjorge/rea-casebook
```

```bash
claude plugin install rea-casebook@rea-casebook
```

## Development

Reading rea's results, the casebook's state, the journal, both exports and the words are plain modules tested directly. The hooks are tested against a simulated engine whose rea answers with real rea 6.4.0 results, with local paths replaced (`tests/fixtures/rea.ts`).

```bash
claude plugin validate .claude-plugin/plugin.json
```

```bash
claude plugin test .
```

CI runs both on Ubuntu, macOS and Windows with Claude Code 2.1.296.

To try a change in a real session, start Claude Code with the folder as a plugin directory; it reloads the mod when its files change:

```bash
claude --plugin-dir .
```

## Status

Version 1.0: the pane, findings that must cite real Evidence, the session journal and the Markdown and artifact exports, tested on Ubuntu, macOS and Windows and used in real sessions with rea 6.4.0. Since 1.0.3 the mod calls no tool and submits no prompt by itself: `/casebook artifact` writes the page and you ask Claude to publish it. Since 1.0.4 every file it writes goes to `~/.rea-casebook/`, and `/casebook export` takes no file name. The design is recorded in [rea-lab](https://github.com/pablodiazjorge/rea-lab) (ADRs 0015 to 0017).

## License

[MIT](LICENSE)
