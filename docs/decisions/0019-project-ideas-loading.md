Status: accepted
Date: 16 Nov 2026
Refines: `docs/decisions/0004-email-gate-and-plan.md` (the plan of three)

# Project ideas are written in the background, and the page never looks empty

## The problem

The owner's complaint: the ideas take a while, nothing seems to be happening, and then the page says there is nothing for them. The cause was in three places. The ideas were written inside the roadmap call, so they added to the first wait. Nothing started them earlier. And an empty list, which the model could return when told not to guess, showed a "we didn't have enough" message with no way to try again.

## What happens now

- The roadmap call no longer writes projects. Right after the roadmap is saved, the ideas are started in their own call (`lib/ai/projects.ts`, `startIdeas` in `lib/roadmap/ideas.ts`). On Workers the work is handed to `waitUntil` (`lib/background.ts`), so it survives the response. By the time someone has been through the gate the ideas are usually ready.
- One run per roadmap. The store lets one caller claim the run (`claimIdeasRun`), so two requests never make two calls. Three columns on `roadmaps` (`ideas_started_at`, `ideas_failed_at`, `ideas_attempts`) hold the state; the unique (roadmap, position) row is the second guard.
- If the ideas aren't there when Projects opens, the page shows a progress state with the shape of the cards (`components/roadmap/IdeasPending.tsx`). It starts the run if nobody has, asks `/api/roadmap/[id]/ideas` every two seconds, and refreshes into the ideas without a reload. After 90 seconds it says so and offers "Try again".
- A real failure, including a model that returns no ideas, says so plainly and offers "Try again". Tries are limited to five per roadmap (`IDEAS_MAX_ATTEMPTS`); after that the page explains and stops offering the button. A run silent for 75 seconds counts as lost.
- There is no "nothing for you" state any more. Older roadmaps whose stored projects were empty start a run when opened.
- The gate order is unchanged (decisions 0003 and 0004), and the AI still uses only facts the person supplied.

## Consequences

- The roadmap email is sent at the gate and includes the ideas if they are ready. For someone signed in, the email goes straight after the roadmap and leaves the project section out.
- The Overview row says "Project ideas to prove them" without a count.
- The after-projects radar reads the plan's ideas, not the roadmap output.

## Testing

The development stand-in can be slow or broken on demand, never in production: `EXHBT_MOCK_IDEAS_DELAY_MS` and `EXHBT_MOCK_IDEAS_FAIL_FIRST` for the whole server, or `[ideas-delay=ms]` and `[ideas-fail=n]` in the builder's skills box for one roadmap. `e2e/phase2-ideas-loading.spec.ts` uses the second form.
