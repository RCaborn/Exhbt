Status: accepted
Date: 23 Nov 2026
Numbered 0025 on `main` until release 2, which already had a 0025 (the key visual from the work).
Amends: 0007 (the shape of the draft's answer; the stored exhbt doc is unchanged)

# The AI draft's answer must fit the API's grammar limit

## What went wrong

Every AI call asks Claude Haiku for a structured answer: a JSON schema sent as `output_config.format`. Before the model writes anything, the API compiles that schema into a grammar, and it refuses a schema whose grammar is too large:

> 400: The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.

The draft's schema was already close to the limit on 16 Nov. On 17 Nov the gallery and research layouts (decision 0024) added `format`, `aim`, `aimIsHypothesis`, `conclusion` and `references`, and it went over. What is known about the date: the shapes the API accepts today imply that drafts failed from 17 Nov, on the live site too. That has not been checked against the live site's log. Nothing caught it, because the tests use a stand-in AI that never sends a request, and the real-AI eval only got its key on 22 Nov.

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

The draft has 38 fields with none nullable. The API takes 16 more fields on top of it, but not 20. With the growth already planned, it has 44 fields and room for 10 more, but not 12. That growth is release 2's `formatReason` (8 values) and, for release 4, 7 layouts, a pull quote, a "my role" line and a before/after mark on each image. Release 4's fields are modelled, because its schema isn't on a branch yet.

## Token room

`max_tokens` has to hold the model's thinking as well as its answer, and the thinking is most of it. `scripts/measure-ai-room.ts` (`npm run measure:ai`) sends each call's own request, with a typical and a heavy input, three times, and records how many tokens each used. Measured on 23 Nov:

- **The portfolio intro was cut off every time with sparse facts.** All three typical runs spent the whole 400 on thinking, so no intro came back. With few facts it thinks longer: up to 1,828 tokens since.
- **The roadmap was cut off once in three with a heavy input** (a 20,000-character CV and a 15-skill job) at its 3,000; the others used up to 2,913.
- **The project swap used 80% of its 1,000, and a header rewrite 71% of its 2,000.**
- The rest fit with room: the figure pick at most 21% of its cap, the job match 15%, the project ideas 48%, and the draft 48% of its 16,000.

Each cap is now at least three times the largest total measured: the intro 6,000, the roadmap 12,000, the swap 3,000 and the rewrites 5,000. A cap is a ceiling, not a cost: a call is billed for the tokens it uses.

## How it is kept that way

- `npm run probe:ai` sends every structured answer the app asks for, using each module's own `output_config`, with a one-line prompt and a tiny `max_tokens`. It fails if one is refused. It also checks "draft with planned growth", so a release can't take the draft over the limit unseen. `--explore` adds the measuring ladders above.
- `.github/workflows/ai-shapes.yml` runs it, and only when a person starts that workflow by hand (Actions tab > "AI request shapes" > Run workflow). The draft eval, also started by hand, runs it first.
- A second job in the same run does `npm run measure:ai` (72 calls, about 12 US cents). It fails if any answer was cut off at `max_tokens`.
- Nothing runs either check automatically. Automatic runs were switched off on 23 Nov 2026 at the owner's request (Rory), after test runs used up the key's monthly allowance. Before that the workflow was set to run the probe on every push or pull request that changed `lib/ai/`, the layout or graph lists, the probe or the lockfile, and both checks weekly, in case the API's limit moved. Nothing now watches for the API's limit moving between runs.
- Run the workflow before a release that changes anything under `lib/ai/` or a schema it uses, such as the layout and graph lists, and only with Rory's say-so, having told him the cost first: about 12 US cents a run, nearly all of it the second job.
- When you add a field to an AI answer, make it non-null and check the count `npm run probe:ai -- --dry` prints against the limit above; that makes no API call, and the probe itself runs before the release. If the draft has to grow past its room, cut fields before reaching for a second call or for unconstrained JSON.
