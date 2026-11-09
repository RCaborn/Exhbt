# Guidance for AI coding tools (Cursor, Claude Code, others)

Exhbt (exhbt.co.uk) helps UK students and graduates get a free skills-gap roadmap for the job they want, then build a portfolio of **exhbts** (short, checked project write-ups with a key-result chart) to send to employers.

Read before changing things:
- `docs/MAP.md`: the current shape. Read this first.
- `HANDOFF.md`: how the app fits together and where everything lives.
- `DESIGN.md`: visual rules (tokens, type, banned patterns). Follow them; don't invent new colours or fonts.
- `CONTRIBUTING.md`: branches, commit messages, ownership.

Rules:
- **One owner per fact.** Plan figures live only in `lib/entitlements.ts`. Hosts live only in `lib/hosts.ts`. Decisions live in `docs/decisions/`. If prose disagrees with the code, the code wins. `docs/PLAN.md` is the old plan and is not current.
- **Builder order:** describe the job, the CV (preferred, skippable), where you are now with education and skills. No email in the builder: it's asked for at the gate before the project ideas, after the radar. The `STEPS` array in `RoadmapWizard.tsx` is the source (`docs/decisions/0003`, `0004`).
- **Words:** "exhbt"/"exhbts" (lower case in running text). Plain British English, no hype words (see the anti-AI-slop writing skill in `.claude/skills/`). `npm run check:docs` rejects the retired name and any plan count copied into prose.
- **Data access** goes through the `Store` interface in `lib/store.ts`; add a method to the interface and both implementations.
- **The AI must only use facts the user supplied.** Keep that rule in prompts (`lib/ai/`).
- **Exhbt layout:** title, outcome, methodology flow (`MethodFlow`), key-result chart, skill boxes, the work, verification, reflection.
- **Charts:** one hue, two shades (`components/charts/series.ts`); values printed; a hidden data table (see `components/exhbt/BeforeAfterChart.tsx`). The skill radar (`components/charts/SkillRadar.tsx`) is the exception: no numbers on it. Its levels are AI estimates, so it marks and lists the skills to level up and the skills in the bag (`SkillHighlights`) and keeps every level in the hidden table.
- **No marketing claims before they're true** (e.g. the jobs-data line is gated in `lib/jobs/claim.ts`).
- **Tests:** run `npm run check` before committing. Update the e2e tests in `e2e/` when you change a flow.
- **Never** commit secrets, edit applied migrations, or push straight to `main`.
