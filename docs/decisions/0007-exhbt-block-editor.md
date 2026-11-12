Status: accepted
Date: 12 Nov 2026

# An exhbt is a fixed set of blocks, edited in place

The AI drafts an exhbt from what the person uploads, as a short, closed set of blocks. The person then has editorial control within hard limits, so every exhbt stays readable in about 30 seconds. It is not a free-form page builder.

- Core blocks, always present: outcome, the process flowchart (method), key result (chart or figure), skills, the work (evidence), reflection. Outcome stays first and reflection last; the rest can be reordered.
- Optional blocks, at most two: bullet list, callout, extra figure, a second flowchart.
- Flowcharts are drawn by our own component (`MethodFlow`) and edited on the diagram itself. No Mermaid.
- Text fields allow bold, italic and links only (a minimal Tiptap editor inside fixed block cards), stored as JSON and rendered by our own renderer.
- The same editor works as cards and in place on the person's own portfolio (edit mode on the app host). The public portfolio host is read-only.
- Limits are checked on save as warnings and enforced on publish, on the server.
- Every number the AI writes must come from the uploaded material; numbers it can't find there are flagged for the person to check.

Limits live in `lib/exhbt.ts` (`EXHBT_LIMITS`); the block schema in `lib/exhbt/blocks.ts`. The plan is `docs/phase-2.md`.
