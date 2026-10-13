# Privacy

rea-casebook is a Claude Code mod that runs on your machine. It has no server, collects no data and sends nothing to its author or to anyone else.

- **What it keeps.** The casebook of each session (the binary rea opened, the Evidence rea returned, the open unknowns and the findings) lives in the Claude Code session and in a journal under `~/.rea-casebook/` in your home folder. The journal names the binary by its file name and SHA-256, never by its local path. The Markdown export and the artifact page go to the same folder. Nothing is ever written into your project.
- **What it reads.** The results of the rea calls your agent already made, and the environment variable `USERPROFILE` or `HOME`, only to find your home folder. It reads no credentials: no token, key or password.
- **What leaves your machine.** Only the casebook page, and only when you ask Claude to publish the page that `/casebook artifact` writes: Claude Code's Artifact tool publishes it to your own claude.ai account as a private artifact, under the terms of that service. The mod itself calls no tool, submits no prompt and has no network access. The page names the binary by file name, never by its local path. You decide whether to share it.
- **Deleting your data.** Delete the `~/.rea-casebook/` folder and any artifact you published from your claude.ai gallery.

Questions: open an issue at https://github.com/pablodiazjorge/rea-casebook/issues.
