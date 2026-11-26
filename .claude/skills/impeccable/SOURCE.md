# Source and changes

- **Source:** https://github.com/pbakaus/impeccable, commit `2fc5e14` ("Merge pull request #1675 from pbakaus/hotfix/cli-4.11.1").
- **Copied:** 26 Nov 2026, for Exhbt.
- **Licence:** Apache License 2.0, copyright 2025 Paul Bakaus. The full text is `LICENSE` beside this file, unchanged. The upstream `NOTICE.md` covers only files not taken here (the iOS and Android references and the browser extension), so it does not apply to these copies.
- **Why:** Rory asked (26 Nov) for well-reviewed design skills. A review found the playbooks worth having and the tooling not: the upstream plugin ships a launcher that downloads and runs a binary, hooks that run it on every edit, telemetry, and commands that rewrite `DESIGN.md`. Only the text is here.

## Files taken

From upstream `.claude/skills/impeccable/reference/`, to `reference/` here: `craft-floor.md`, `audit.md`, `critique.md`, `critique-rubric.md`, `polish.md`, `operate.md`, `layout.md`, `typeset.md`, `harden.md`, `adapt.md`, `clarify.md`, `distill.md`, `quieter.md`, `bolder.md`, `delight.md`, `animate.md`, `overdrive.md`, `onboard.md`, `optimize.md`. From the repository root: `LICENSE`.

`SKILL.md` and this file are Exhbt's own, not upstream's.

## Changes (Apache-2.0 section 4(b))

Every copy starts with a one-line comment saying it was changed and pointing here. The design advice is otherwise as upstream wrote it. Changes, by file:

- **All files:** "hand off to `/impeccable polish`" now points to `polish.md`. There is no `/impeccable` command router here.
- **audit.md:** the native-platform pointer (`audit.native.md`, not copied) replaced with a note that Exhbt is web-only. "Run the bundled detector" replaced with reading the source and rendered pages. The desktop-app paragraph (opening a DevTools port and running `impeccable detect --cdp`) removed. "Detector findings" in the verdict replaced with file-and-line evidence. The command list now names the copied playbooks only (`colorize`, `document` and `shape` were not copied). The "Save the Report" section removed: it wrote a temp file, ran `impeccable audit-storage write` and could upload the report to an Impeccable account.
- **critique.md:** the most changed. Upstream's Assessment B ran the detector (`impeccable detect`), started `impeccable live-server`, injected `detect.js` from localhost into the page, and attached to desktop apps over a DevTools port. It is rewritten as "Rendered evidence" using the project's own tools (Playwright screenshots at two widths, the axe spec, contrast, a keyboard pass). The degraded-run banner and the native-platform path went with it. Setup's `impeccable critique-storage slug` and the `.impeccable/critique/ignore.md` read removed. "Persist the Snapshot" removed (it wrote `.impeccable/critique/`, read a trend, and could upload to an Impeccable account). `PRODUCT.md`'s `## Users` (written by `impeccable init`) replaced with the project's own audience notes. `AskUserQuestion` replaced with "ask the user", with a note for subagents. Command lists now name the copied playbooks.
- **critique-rubric.md:** project personas come from the project's own audience notes, not a `PRODUCT.md` written by `impeccable init`.
- **craft-floor.md:** the sentence about the design hook enforcing the checks removed. `impeccable shot` replaced with screenshots from the project's own browser tooling. `impeccable font-fetch` (downloads a font) replaced with "use the project's font setup; ask before adding a face".
- **polish.md:** `impeccable shot` replaced as above; native device capture removed from that step. `impeccable critique-storage latest` and `close` replaced with "use a critique already in the conversation". "Follow the guidance from `impeccable context` and hooks" replaced with the project's own QA checks.
- **layout.md, typeset.md:** native pointers (`ios.md`, `android.md`) and `new-work.md` (not copied) removed. `impeccable detect --scope layout|type` replaced with a manual mechanical check of computed values. The "Live-mode signature params" sections removed. In typeset, "route through new-work.md and update DESIGN.md" replaced with "stop and ask; do not edit DESIGN.md", and the detector's `straggler` finding names replaced with plain words.
- **animate.md:** the native pointer removed. `impeccable motion-capture` (writing to `.impeccable/review/`) and the shipped `impeccable-motion-reviewer` agent replaced with frames taken in Playwright and kept outside the repository, reviewed against the same criteria, two rounds at most.
- **adapt.md:** the native pointer (`adapt.native.md`) replaced with a web-only note.
- **bolder.md:** the opening reference to `new-work.md`'s direction round replaced with "a direction question goes to the design owner". `AskUserQuestion` replaced as in critique.
- **distill.md, quieter.md, overdrive.md:** `AskUserQuestion` replaced as in critique. Overdrive's opening banner removed, and a line added that a named library is an option, not permission to add a dependency.
- **onboard.md, optimize.md:** a line added that a named library, analytics tool, CDN or hosted monitoring service is an option, not permission.
- **operate.md:** only the header comment; its "SKILL.md's modes" now means Exhbt's `SKILL.md`, which defines them.

`npm run check:docs` skips `.claude/`, so it does not read these files. They were checked by hand for the retired product name, plan counts and model names; none needed a change.

## Left out, and why

- **Upstream `SKILL.md`**: routes to the launcher, `init`, `document`, `extract`, `live` and hooks. Replaced by Exhbt's own.
- **`scripts/`** (the launcher and the engine it downloads), **hooks**, **agents** (the motion reviewer), and the plugin manifests: they run code on the machine and outside the sandbox, send telemetry, and can write `DESIGN.md`.
- **Other references** (`init`, `document`, `extract`, `live`, `live-setup`, `hooks`, `doctor`, `new-work*`, `shape`, `generate`, `colorize`, `visualize`, `component-review`, `foundations`, `routing`, `region-map`, `mode-*`, `craft`, the native and platform files, `degraded/`): either they drive the tooling above, they set a new visual direction (Exhbt's is fixed), or they cover native apps.
