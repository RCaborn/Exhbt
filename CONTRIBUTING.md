# Working on Exhbt

Two people (Rory and Alex), plus AI tools (Claude Code, Cursor with Claude/Grok). These rules keep us from stepping on each other.

## Branches

- **`main` is live.** Every push to `main` deploys to Cloudflare automatically. Never push unfinished work to it.
- Work on a branch named `<who>/<what>`, e.g. `rory/quiz-copy` or `alex/exhbt-editor`. AI sessions may use their own prefixes (e.g. `claude/...`).
- Open a pull request into `main`. The other person reviews it, and merges once CI is green.
- Keep branches short-lived (a day or two). Pull `main` into your branch before opening the PR.

## Who works on what

Agreed 6 Nov 2026: **Rory leads architecture; Alex reviews and iterates.** Don't edit the same component at the same time. Claim it first in the team chat ("taking the pricing page") and release it when merged.

| Area | Main files |
|---|---|
| Home and marketing pages | `app/(marketing)/`, `components/home/` |
| Roadmap builder (quiz) | `app/(app)/roadmap/new/`, `app/(app)/roadmap/actions.ts` |
| Roadmap result screens | `components/roadmap/` |
| Exhbt card and chart | `components/exhbt/`, `lib/exhbt.ts` |
| AI prompts and jobs data | `lib/ai/`, `lib/jobs/`, `scripts/import-jobs.mjs` |
| Data, sign-in, email | `lib/store.ts`, `lib/auth.ts`, `lib/email/`, `supabase/migrations/` |
| Design tokens | `app/globals.css`, `DESIGN.md` |

## Commit messages

Say **what changed and why**, so the history explains itself:

```
Move email to step 4 of the roadmap builder

Agreed in the 6 Nov meeting: people see more value before giving
their email. Updates the wizard, server-side step mapping and tests.
```

- First line: imperative, under about 70 characters ("Add…", "Fix…", "Move…"), no full stop.
- Body: the reason, and anything a reviewer should check.
- One logical change per commit. Don't mix a redesign with a bug fix.

## Before you push

```bash
npm run check   # typecheck, lint, build and all end-to-end tests
```

CI runs the same on every push and pull request. Don't merge with it red. Never skip or delete a test to make it pass; fix the cause, or ask.

## Database changes

Never edit a migration that has already been run on the live Supabase project. Add a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_what.sql`, then run it in Supabase's SQL editor after merging.

## Secrets

Keys live in Cloudflare and Supabase dashboards and in your own `.env.local`. Never commit them, and never paste them into chat (including AI chat).

## Using AI tools

`AGENTS.md` (read by Cursor) and `CLAUDE.md` (read by Claude Code) give AI tools the project rules. Review AI-written code like a colleague's: read the diff before committing.
