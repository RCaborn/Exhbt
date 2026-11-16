Status: accepted
Date: 12 Nov 2026

# An exhbt is a fixed set of blocks, edited in place

The AI drafts an exhbt from what the person uploads, as a short, closed set of blocks. The person then has editorial control within hard limits, so every exhbt stays readable in about 30 seconds. It is not a free-form page builder.

- Layout (Rory, 12 Nov 2026), built for a recruiter's quick read, mostly bullets, 150–200 words:
  - header: the person's photo and name top left, skill boxes top right, the title
  - then context and the gap, the process flowchart straight after it, findings as bullets, one or two graphs, and up to two images
  - a small footer with the original work and the trust badge
- The order is fixed. People edit every word and add or remove flowchart boxes, findings, graphs and images within the limits.
- Flowcharts are drawn by our own component (`MethodFlow`) and edited on the diagram itself. No Mermaid.
- Text fields allow bold, italic and links only (a minimal Tiptap editor inside fixed block cards), stored as JSON and rendered by our own renderer.
- The same editor works as cards and in place on the person's own portfolio (edit mode on the app host). The public portfolio host is read-only.
- Limits are checked on save as warnings and enforced on publish, on the server.
- Every number the AI writes must come from the uploaded material; numbers it can't find there are flagged for the person to check.

Limits live in `lib/exhbt.ts` (`EXHBT_LIMITS`); the block schema in `lib/exhbt/blocks.ts`. The plan is `docs/phase-2.md`.
