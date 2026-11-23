Status: accepted
Date: 23 Nov 2026
Amends: 0007 (the shape of the draft's answer; the stored exhbt doc is unchanged)

# The AI draft's answer must fit the API's grammar limit

## What went wrong

Every AI call asks Claude Haiku for a structured answer: a JSON schema sent as `output_config.format`. Before the model writes anything, the API compiles that schema into a grammar, and it refuses a schema whose grammar is too large:

> 400: The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.

The draft's schema was already close to the limit on 16 Nov. On 17 Nov the gallery and research layouts (decision 0024) added `format`, `aim`, `aimIsHypothesis`, `conclusion` and `references`, and it went over. From then on every draft failed, on the live site too. Nothing caught it, because the tests use a stand-in AI that never sends a request, and the real-AI eval only got its key on 22 Nov.

The first real eval runs then showed a second fault behind the first. With the schema fixed, five of the eight eval drafts still failed: the model thinks before it answers, and with `max_tokens` at 4,000 the answer was cut off half-written. Thinking took roughly 1,400 to 4,900 tokens per draft, and a whole draft up to 5,825.

No other AI feature was affected. The rewrites, the figure pick, the job match, the portfolio intro, the project ideas and swap, and the roadmap were all accepted.

## What the limit is

Measured with `scripts/probe-ai-shapes.ts` on 23 Nov, by adding fields to a schema until the API refused it. The results were the same on every repeat.

- **What counts is the number of fields.** The limit is about 52 to 55 fields in all, counting every property at every depth. A string, a number and a boolean each cost the same. A field inside a graph's rows costs the same as one at the top. Sharing one definition through `$ref` doesn't help.
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

## How it is kept that way

- `npm run probe:ai` sends every structured answer the app asks for, using each module's own `output_config`, with a one-line prompt and a tiny `max_tokens`. It fails if one is refused. It also checks "draft with planned growth", so a release can't take the draft over the limit unseen. `--explore` adds the measuring ladders above.
- `.github/workflows/ai-shapes.yml` runs it whenever `lib/ai/`, the layout or graph lists, the probe or the lockfile change. It also runs weekly, in case the API's limit moves. The draft eval runs it first.
- When you add a field to an AI answer, make it non-null and run the probe. If the draft has to grow past its room, cut fields before reaching for a second call or for unconstrained JSON.
