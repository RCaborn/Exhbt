# Guidance for AI coding tools (Cursor, Claude Code, others)

Exhbt (exhbt.co.uk) helps UK students and graduates get a free skills-gap roadmap for the job they want, then build a portfolio of **exhbts** (short, checked project write-ups with a key-result chart) to send to employers.

Read before changing things:
- `HANDOFF.md`: how the app fits together and where everything lives.
- `DESIGN.md`: visual rules (tokens, type, banned patterns). Follow them; don't invent new colours or fonts.
- `CONTRIBUTING.md`: branches, commit messages, ownership.

Rules:
- **Product decisions** (6 Nov 2026 meeting):
  - The builder asks, in order: describe the job, current situation, education and skills (CV optional), email.
  - Free = roadmaps with limited refreshes and no exhbts.
  - Premium = hosted exhbts plus per-employer links.
  - Universities pay; employers are always free.
  - Plan rules live only in `lib/entitlements.ts`.
- **Words:** "exhbt"/"exhbts" (lower case in running text), never "evidence pack". Plain British English, no hype words (see the anti-AI-slop writing skill in `.claude/skills/`).
- **Data access** goes through the `Store` interface in `lib/store.ts`; add a method to the interface and both implementations.
- **The AI must only use facts the user supplied.** Keep that rule in prompts (`lib/ai/`).
- **Charts:** one hue, two shades; values printed; a hidden data table (see `components/exhbt/BeforeAfterChart.tsx`).
- **Tests:** run `npm run check` before committing. Update the e2e tests in `e2e/` when you change a flow.
- **Never** commit secrets, edit applied migrations, or push straight to `main`.
