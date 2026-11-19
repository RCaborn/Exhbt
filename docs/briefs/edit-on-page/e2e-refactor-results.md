# E2E helper move: test results

Run on the desktop Playwright project, one worker, port 3214, no trace. Base is `origin/phase-2` at 61e91cd.

| Spec | Tests | Before (base) | After (this branch) |
| --- | --- | --- | --- |
| `file-ownership.spec.ts` | 1 | 1 passed | 1 passed |
| `phase2-billing-polish.spec.ts` | 7 | 7 passed | 7 passed |
| `phase2-editor-media.spec.ts` | 15 | 15 passed | 15 passed |
| `phase2-editor.spec.ts` | 10 | 10 passed | 10 passed |
| `phase2-graphs.spec.ts` | 16 | 16 passed | 16 passed |
| `phase2-sections.spec.ts` | 15 | 15 passed | 15 passed |
| `phase2-draft-tools.spec.ts` | 11 | 11 passed | 11 passed |
| `phase2-polish-2.spec.ts` | 13 | 13 passed | 13 passed (first run 12 passed, 1 failed: "Phone header, Max: Job links is in the menu, and a tap outside closes it", which does not use a moved helper; it passed alone and on a full re-run) |
| `phase2-formats.spec.ts` | 80 | interrupted at test 77 by a container restart (77 passed); to be re-run | |
