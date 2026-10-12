# Privacy

rea-casebook is a Claude Code mod that runs on your machine. It has no server, collects no data and sends nothing to its author or to anyone else.

- **What it keeps.** The casebook of each session (the binary rea opened, the Evidence rea returned, the open unknowns and the findings) lives in the Claude Code session and in a journal under `~/.rea-casebook/` in your home folder. The journal names the binary by its file name and SHA-256, never by its local path. Nothing is written into your project unless you run `/casebook export`.
- **What it reads.** The results of the rea calls your agent already made, and the environment variable `USERPROFILE` or `HOME` to find your home folder. It reads no credentials.
- **What leaves your machine.** Only the casebook page, and only when you run `/casebook artifact`: Claude Code's Artifact tool publishes it to your own claude.ai account as a private artifact, under the terms of that service. The page names the binary by file name, never by its local path. You decide whether to share it.
- **Deleting your data.** Delete the `~/.rea-casebook/` folder and any artifact you published from your claude.ai gallery.

Questions: open an issue at https://github.com/pablodiazjorge/rea-casebook/issues.
