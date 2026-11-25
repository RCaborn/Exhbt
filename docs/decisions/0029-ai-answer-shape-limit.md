Status: accepted
Date: 23 Nov 2026
Numbered 0025 on `main` until release 2, which already had a 0025 (the key visual from the work).
Amends: 0007 (the shape of the draft's answer; the stored exhbt doc is unchanged)
Added to in place on 25 Nov 2026: "Emphasis inside the answer", at the end (the draft and the rewrite mark bold and italic inside the text they return, with no field added)

# The AI draft's answer must fit the API's grammar limit

## What went wrong

Every AI call asks Claude Haiku for a structured answer: a JSON schema sent as `output_config.format`. Before the model writes anything, the API compiles that schema into a grammar, and it refuses a schema whose grammar is too large:

> 400: The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.

The draft's schema was already close to the limit on 16 Nov. On 17 Nov the gallery and research layouts (decision 0024) added `format`, `aim`, `aimIsHypothesis`, `conclusion` and `references`, and it went over. The date is inferred, not read from a log. What is known: the schema reached `main`, which deploys the live site, on the evening of 17 Nov, and the shapes the API accepts today imply that drafts failed from then, on the live site too. That has not been checked against the live site's log. Nothing caught it, because the tests use a stand-in AI that never sends a request, and the real-AI eval only got its key on 22 Nov.

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

When this was measured the draft had 38 fields with none nullable, and the API took 16 more fields on top of it, but not 20. Release 2's `formatReason` has since made it 39 (`npm run probe:ai -- --dry` prints the count). The growth already decided takes it to 48 fields: release 4's seven layouts, about twelve layout reasons, a pull quote, a "my role" line, an essay's sources and a build's demo and code links (decision 0028; Before and After marks are never drafted). That leaves room for 4 more fields, but not 6, so release 4 has little to spare: anything beyond what 0028 lists needs a field cut first. Release 4's own schema isn't on a branch yet, so its fields are modelled in the probe.

**Release 4, as built (25 Nov 2026).** The seven-layout answer is 41 fields, not 48, with none nullable. It adds only `pullquote` and `myRole`: an essay's sources and a build's links are rows of `references` (a label and an address, the address empty for a source with none), so neither has a list of its own. It is sent only for a person whose editor is the new one (`DraftSchemaSeven`, `lib/ai/draft-answer.ts`); everyone else is sent the 39-field answer above, unchanged, so the draft the live site sends is the one already proven. The probe sends both as the app does, and keeps the 48-field shape as a rung of its own ("draft: seven layouts, with room for 7 more fields"): while that is accepted, the draft has at least that much room. `e2e/layouts-new.spec.ts` holds the two counts, so a field can't be added unseen. When this was written no call to the real API was allowed, so the 41-field shape has not been sent to it: the probe's next real run is its first check.

## Token room

`max_tokens` has to hold the model's thinking as well as its answer, and the thinking is most of it. `scripts/measure-ai-room.ts` (`npm run measure:ai`) sends each call's own request, with a typical and a heavy input, three times, and records how many tokens each used. Measured on 23 Nov:

- **The portfolio intro was cut off every time with sparse facts.** All three typical runs spent the whole 400 on thinking, so no intro came back. With few facts it thinks longer: up to 1,828 tokens since.
- **The roadmap was cut off once in three with a heavy input** (a 20,000-character CV and a 15-skill job) at its 3,000; the others used up to 2,913.
- **The project swap used 80% of its 1,000, and a header rewrite 71% of its 2,000.**
- The rest fit with room: the figure pick at most 21% of its cap, the job match 15%, the project ideas 48%, and the draft 48% of its 16,000.

Each cap is now at least three times the largest total measured, up to the SDK's ceiling for a call that doesn't stream (about 21,333 with SDK 1.6.0, `SDK_NONSTREAMING_MAX_TOKENS` in `lib/ai/model.ts`; above it the SDK refuses the call). The intro is 6,000, the roadmap 12,000, the project ideas 4,000 (a heavy run later used 1,173 of the old 1,500), the swap 3,000, the rewrites 5,000, and a scanned CV's read 21,000 (a 6-page scan used 6,891 of the old 8,000). The draft's 16,000 is about twice its largest (7,745): three times would pass the ceiling. A scanned report's read stays at 16,000 (a 12-page scan used 4,240); a longer one is cut off and the page tells the person only the first part was read. A cap is a ceiling, not a cost: a call is billed for the tokens it uses.

## How it is kept that way

- `npm run probe:ai` sends every structured answer the app asks for, using each module's own `output_config`, with a one-line prompt and a tiny `max_tokens`. It fails if one is refused. It also checks "draft with planned growth", so a release can't take the draft over the limit unseen. `--explore` adds the measuring ladders above.
- `.github/workflows/ai-shapes.yml` runs it, and only when a person starts that workflow by hand (Actions tab > "AI request shapes" > Run workflow). The draft eval, also started by hand, runs it first.
- A second job in the same run does `npm run measure:ai`: 84 calls, about 15 US cents, now that it also reads scanned files (the workflow file's own header still gives the earlier 72 calls and 12 cents). It reads every answer the way the app does and fails if one couldn't be read (cut off, wrong shape, refused, a service error). A scanned file's read that is cut off is not a failure: the page tells the person only the first part was read.
- Nothing runs either check automatically: no push, no pull request, no deploy and no schedule. Automatic runs were switched off on 23 Nov 2026 at the owner's request (Rory), after test runs used up the key's monthly allowance. Before that the workflow was set to run the probe on every push or pull request that changed `lib/ai/`, the layout or graph lists, the probe or the lockfile, and both checks weekly, in case the API's limit moved. A hotfix branch also put the probe into CI's check job and before every deploy; those steps were taken out before the branch was merged, for the same reason, and the probe's `--warn-unchecked` option is what is left of them. Nothing now watches for the API's limit moving between runs.
- Run the workflow before a release that changes anything under `lib/ai/` or a schema it uses, such as the layout and graph lists, and only with Rory's say-so, having told him the cost first: about 15 US cents a run, nearly all of it the second job.
- When you add a field to an AI answer, make it non-null and check the count `npm run probe:ai -- --dry` prints against the limit above; that makes no API call, and the probe itself runs before the release. If the draft has to grow past its room, cut fields before reaching for a second call or for unconstrained JSON.

## Failing softly and visibly

Added after a review of the first two fixes.

- **Softly.** The SDK sends an enum, a list's maximum and a number's range only as description text, so the model can write a value outside them, and the strict schema used to fail the whole feature for one stray value (a 7th gap, a project of 24 weeks, a graph of kind "pie"). Every structured call now goes through `structuredCall` (`lib/ai/call.ts`): the request on the wire is unchanged, the answer is read as JSON, repaired where that needs no guessing (`lib/ai/repair.ts`, `repairDraft`: lists cut to their cap, levels and weeks pulled into range, an unknown evidence value read as "none", an unknown layout read as a case study, an unknown reason for the layout read as "default", which says no reason, a graph of an unknown kind dropped, a picked figure of an unknown kind read as "other"), and only then read by the strict schema.
- **Visibly.** `structuredCall` looks at why the model stopped before it reads a word, and a failure throws one `AIFailure`: the feature, the reason (ran out of room, refused, wrong shape, service error with its status, empty) and the tokens spent. A service error is a call the service never answered: the request itself failed (no connection, a timeout, or the API refusing it or failing), and nothing was made or paid for. Only that gets the reason `service`; anything else the SDK throws is our own code or setup, and is passed on as it is and recorded as `error`, with its cause in the Worker's log. Each caller logs a failure as an event with those fields and no text from the person or the model, and the admin panel's "Failed AI calls" shows each feature's failures, why, and what they cost. Before this, a failed draft left only a line in the Worker's log: `ai_call_logs` and the events table recorded successes only, which is why six days of failed drafts were invisible.
- **At a limit.** A failed draft, rewrite, intro, idea swap, job match or roadmap never uses up a person's allowance. So that a call that keeps failing can't be retried without limit at our cost, one person (or a signed-out roadmap) gets at most 5 failed calls of a feature a day; after that the feature makes no call. What is counted is a failure the service answered (cut off, refused, the wrong shape, empty), which cost something, and a failure nobody foresaw, which is the safe side. A call the service never answered (the key out of credit, the API down, no connection: `neverAnswered` in `lib/ai/failure.ts`) is recorded and shown in the panel, and not counted: it cost nothing and isn't the person's doing, and counted, an outage would lock people out for a day and keep them out after the service was back. The draft, a rewrite, the intro, an idea swap and a job match then say so ("This isn't working for you at the moment…"). A roadmap shows its usual "That didn't work" screen. File reads were already bounded, because they are counted before the call, and project ideas by their own five attempts a roadmap.
- **A figure pick has its own rule, and not that limit.** It is counted before the call, so that requests that overlap can't all pass the check, and given back only when the service never answered (decision 0025, second review). That one rule does the limit's job: a failed pick that cost something stays counted against the person's picks, and one that is given back cost nothing. The give-back asks `neverAnswered` (`lib/ai/failure.ts`), which is true of an `AIFailure` whose reason is `service` and of nothing else, so there is one name for it across the app. Every failed pick, given back or not, is recorded as a failure event like any other. This branch first gave the pick the 5-a-day limit, when a failed pick wasn't counted at all; it was taken off when the two were brought together, because five picks the service never answered must not stop a sixth that would work.
- **A scan cut off** at `max_tokens` keeps what was read, and the draft page says under the file that only the first part was read.
- **A roadmap generated twice** (a reload, a second tab): the first result saved wins, and the later one hands back what was saved. Stopping the second AI call itself needs a database column, so it waits.
- **Cost.** A prompt over 100,000 input tokens is priced at the higher rate (input and output), call by call.

## Emphasis inside the answer (25 Nov 2026)

Rory, 25 Nov 2026: "Maybe we could do some AI bolding where we think it should be, or italics where it's important information; make it really skimmable within the AI-generated bit."

The draft and the rewrite of a section mark emphasis inline, in the text they already return, as `**bold**` and `*italic*`. No field is added to either answer, so their sizes are as they were: 39 fields for the three-layout draft, 41 for the seven-layout one, and the rewrites unchanged (`npm run probe:ai -- --dry`, 25 Nov 2026).

**What the AI may mark, and why.**

- Only the parts that read as paragraphs: each finding, what I'd do next, and research's aim and conclusion; in a rewrite, the findings. These are what a recruiter skims, and a result or a number in bold is found at a glance.
- Bold: one phrase at most in each, of at most six words, for the key result or number. Never a whole sentence, and none where nothing stands out.
- Italic: rarely, for a term or the title of a work. One at most in each, of at most eight words.
- Nowhere else. One-line fields, the title, the flowchart's boxes and the graphs' labels are short and set apart by the page already. The context line keeps its own meaning: its bold is the gap it highlights, named by `gapHighlight` (decision 0022), never a mark of the AI's.

**What the code holds it to, whatever the model sends** (`lib/exhbt/emphasis.ts`):

- A mark hugs a word: `**` or `*` at the start of a word opens and at the end of one closes. One inside a word, or with a space on both sides, is part of the words ("2 * 3", "x**2").
- Marks left open, nested, crossed or past the limits are dropped, and their words kept. A mark that pairs with nothing is kept only where the material has it as written, so an A* grade or a significance star (0.42**) stays as it was.
- Every other field is read with the marks taken out before any check (`plainAnswer` in `lib/ai/draft-answer.ts`, `toBlockValue` in `lib/ai/exhbt-rewrite.ts`).
- Word counts, the number check and the checks that keep only what the person supplied read the plain words. A number's source quote, a quote, a pull quote, a role and an essay's source are looked for in the material as written, and again with the marks taken out of both (`misquoted` in `lib/exhbt/verify.ts`, `saidIn` in `lib/exhbt/references.ts`). So a mark, the AI's or a Markdown file's own, never makes a true quote look made up, and a quote whose words aren't there is still caught.

Only new drafts and rewrites carry marks; exhbts already stored are unchanged. A person takes any of it off with the editor's Bold or Italic button. The stand-in AI marks one word of its placeholder finding, and with "stand-in: bad emphasis" in the notes writes marks the rules refuse, so the tests reach the editors, the page and print without the API (`e2e/ai-emphasis.spec.ts`).

**Not yet checked against the real model**, because no call to the API was allowed when this was written: how often Haiku marks and what it marks, whether it keeps to one phrase of six words, and whether the added rules change the drafts' words or their length. The three-layout prompt's words are no longer exactly those the live site was proven on; its answer's shape is. The figure pick's caption is not marked: the pick is a call of its own, with its own prompt.
