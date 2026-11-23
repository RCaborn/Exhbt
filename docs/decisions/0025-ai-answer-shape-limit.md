Status: accepted
Date: 23 Nov 2026
Amends: 0007 (the shape of the draft's answer; the stored exhbt doc is unchanged)

# The AI draft's answer must fit the API's grammar limit

## What went wrong

Every AI call asks Claude Haiku for a structured answer: a JSON schema sent as `output_config.format`. Before the model writes anything, the API compiles that schema into a grammar, and it refuses a schema whose grammar is too large:

> 400: The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.

The draft's schema was already close to the limit on 16 Nov. On 17 Nov the gallery and research layouts (decision 0024) added `format`, `aim`, `aimIsHypothesis`, `conclusion` and `references`, and it went over. The date is inferred, not read from a log: the schema reached `main` and was deployed on the evening of 17 Nov, and the shapes the API accepts today imply that drafts failed from then, on the live site too. That has not been checked against the live site's log. Nothing caught it, because the tests use a stand-in AI that never sends a request, and the real-AI eval only got its key on 22 Nov.

The first real eval runs then showed a second fault behind the first. With the schema fixed, five of the eight eval drafts still failed: the model thinks before it answers, and with `max_tokens` at 4,000 the answer was cut off half-written. Thinking took roughly 1,400 to 4,900 tokens per draft, and a whole draft up to 5,825.

No other request shape was refused: the rewrites, the figure pick, the job match, the portfolio intro, the project ideas and swap, and the roadmap were all accepted. But two of them had the second fault too (below, "Token room").

## What the limit is

Measured with `scripts/probe-ai-shapes.ts` on 23 Nov, by adding fields to a schema until the API refused it. The results were the same on every repeat.

- **What counts is mostly the number of fields.** The limit is about 52 to 56 fields in all, counting every property at every depth. A string, a number and a boolean each cost the same. A field inside a graph's rows costs the same as one at the top. Sharing one definition through `$ref` doesn't help. An array of objects costs a little more than its fields: four extra lists of two-field objects were refused at a size where twelve extra strings were accepted.
- **A nullable field costs about two.** Each is a union in the grammar. The 16 Nov draft (41 fields, 9 of them nullable) took one more nullable field, but not two.
- **There is a second, hard limit: 16 nullable or union-typed fields.** Past it the API refuses with its own message ("too many parameters with union types").
- **Enums cost nothing today**, because the SDK (1.6) moves an enum into the field's description instead of sending it. A later SDK might send real enums. The planned growth still fits with them sent.

On `main`, making every nullable field non-null was enough to be accepted, but left room for only three more fields.

## The draft's answer now

- **Nothing is nullable.** An empty string, an empty list or `false` means "none", exactly as `null` did. A flow step's `detail` is empty when there is none; the quote is three empty strings when there is none. `lowerIsBetter: false` stores nothing on the graph kinds where it is optional, as `null` did before.
- **Every graph kind shares one row type**, `{ label, values }`. A scatter point is a row with values `[x, y]`. A number tile is a row with values `[value]` or `[value, from]`, with its unit at the same place in `series`. A table's headings are the first row of `cells`. The separate `points`, `tiles` and `columns` fields are gone.
- **`max_tokens` is 16,000**, so the thinking and the answer both fit.

`toChart` and `toDoc` turn this into the same stored exhbt doc as before, so `SCHEMA_VERSION` and `ai_version` are unchanged. The prompt keeps every rule: only facts in the material, every number quoted with its source, quotes word for word, nothing invented.

The draft has 38 fields with none nullable. The API takes 16 more fields on top of it, but not 20. The growth already decided takes it to 48 fields: release 2's `formatReason`, and release 4's seven layouts, about twelve layout reasons, a pull quote, a "my role" line, an essay's sources and a build's demo and code links (decision 0028; Before and After marks are never drafted). That leaves room for 4 more fields, but not 6, so release 4 has little to spare: anything beyond what 0028 lists needs a field cut first. Release 4's own schema isn't on a branch yet, so its fields are modelled in the probe.

## Token room

`max_tokens` has to hold the model's thinking as well as its answer, and the thinking is most of it. `scripts/measure-ai-room.ts` (`npm run measure:ai`) sends each call's own request, with a typical and a heavy input, three times, and records how many tokens each used. Measured on 23 Nov:

- **The portfolio intro was cut off every time with sparse facts.** All three typical runs spent the whole 400 on thinking, so no intro came back. With few facts it thinks longer: up to 1,828 tokens since.
- **The roadmap was cut off once in three with a heavy input** (a 20,000-character CV and a 15-skill job) at its 3,000; the others used up to 2,913.
- **The project swap used 80% of its 1,000, and a header rewrite 71% of its 2,000.**
- The rest fit with room: the figure pick at most 21% of its cap, the job match 15%, the project ideas 48%, and the draft 48% of its 16,000.

Each cap is now at least three times the largest total measured, up to the SDK's ceiling for a call that doesn't stream (about 21,333 with SDK 1.6.0, `SDK_NONSTREAMING_MAX_TOKENS` in `lib/ai/model.ts`; above it the SDK refuses the call). The intro is 6,000, the roadmap 12,000, the project ideas 4,000 (a heavy run later used 1,173 of the old 1,500), the swap 3,000, the rewrites 5,000, and a scanned CV's read 21,000 (a 6-page scan used 6,891 of the old 8,000). The draft's 16,000 is about twice its largest (7,745): three times would pass the ceiling. A scanned report's read stays at 16,000 (a 12-page scan used 4,240); a longer one is cut off and the page tells the person only the first part was read. A cap is a ceiling, not a cost: a call is billed for the tokens it uses.

## How it is kept that way

- `npm run probe:ai` sends every structured answer the app asks for, using each module's own `output_config`, with a one-line prompt and a tiny `max_tokens`. It fails if one is refused. It also checks "draft with planned growth", so a release can't take the draft over the limit unseen. `--explore` adds the measuring ladders above.
- The probe runs in CI's check job on every push and pull request, and before every deploy. A refused shape fails both; a missing key (a fork's pull request) or an unreachable API only warns, so an outage doesn't block a deploy. `.github/workflows/ai-shapes.yml` runs it weekly too, in case the API's limit moves, and the draft eval runs it first.
- The same workflow runs `npm run measure:ai` weekly and by hand (84 calls, about 15 US cents). It reads every answer the way the app does and fails if one couldn't be read (cut off, wrong shape, refused, a service error).
- When you add a field to an AI answer, make it non-null and run the probe. If the draft has to grow past its room, cut fields before reaching for a second call or for unconstrained JSON.

## Failing softly and visibly

Added after a review of the first two fixes.

- **Softly.** The SDK sends an enum, a list's maximum and a number's range only as description text, so the model can write a value outside them, and the strict schema used to fail the whole feature for one stray value (a 7th gap, a project of 24 weeks, a graph of kind "pie"). Every structured call now goes through `structuredCall` (`lib/ai/call.ts`): the request on the wire is unchanged, the answer is read as JSON, repaired where that needs no guessing (`lib/ai/repair.ts`, `repairDraft`: lists cut to their cap, levels and weeks pulled into range, an unknown evidence value read as "none", an unknown layout read as a case study, a graph of an unknown kind dropped), and only then read by the strict schema.
- **Visibly.** `structuredCall` looks at why the model stopped before it reads a word, and a failure throws one `AIFailure`: the feature, the reason (ran out of room, refused, wrong shape, service error with its status, empty) and the tokens spent. Each caller logs it as a failure event with those fields and no text from the person or the model, and the admin panel's "Failed AI calls" shows each feature's failures, why, and what they cost. Before this, a failed draft left only a line in the Worker's log: `ai_call_logs` and the events table recorded successes only, which is why six days of failed drafts were invisible.
- **At a limit.** A failure never uses up a person's allowance. So that a call that keeps failing can't be retried without limit at our cost, one person (or a signed-out roadmap) gets at most 5 failed calls of a feature a day; after that the feature says so and makes no call. Figure picks and file reads were already counted before the call.
- **A scan cut off** at `max_tokens` keeps what was read, and the draft page says under the file that only the first part was read.
- **A roadmap generated twice** (a reload, a second tab): the first result saved wins, and the later one hands back what was saved. Stopping the second AI call itself needs a database column, so it waits.
- **Cost.** A prompt over 100,000 input tokens is priced at the higher rate (input and output), call by call.
