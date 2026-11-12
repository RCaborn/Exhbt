@AGENTS.md

## How Claude Code works on this repo (Rory, 12 Nov 2026)

- The main session **orchestrates**: it plans, splits the work, writes the briefs, reviews what comes back and talks to Rory. It does not write the code itself.
- **Opus subagents do the building**: code, tests, docs, running the checks, committing. Give each one a complete brief (branch, files, conventions, what done looks like, the commit attribution) because it starts cold.
- **Haiku subagents** handle Notion lookups and saves.
- Phase 2 work goes on the `phase-2` branch (`docs/phase-2.md`, section 10). `main` deploys the live site; nothing lands there until launch day.
