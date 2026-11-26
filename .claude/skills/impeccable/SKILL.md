---
name: impeccable
description: Design playbooks for auditing, critiquing and polishing an existing Exhbt screen, and for checking its motion, boldness, layout, type, copy and edge cases. Use when reviewing or refining a page or component that already exists, not for setting a new visual direction.
---

# Impeccable playbooks (text only)

Vetted design playbooks from `pbakaus/impeccable`, copied as text and changed for Exhbt (`SOURCE.md`). Read the playbook for the job, then work on the code yourself.

## Order of authority

1. **The fixed brand**: mint, jade, ink and white; Bricolage Grotesque and Inter (`docs/brand.md`, `AGENTS.md`).
2. **Astryx**, the design system: `docs/design/astryx-agent-guide.md` if present, and `npm run astryx -- docs principles`.
3. **`DESIGN.md`**: tokens, type scale, motion, banned patterns, the exhbt layout.
4. **These playbooks.**

Where a playbook disagrees with anything above it, the playbook loses. Upstream's tooling flags Inter as an overused font; Inter is Exhbt's own and stays. Never edit `DESIGN.md`, the brand or the theme to suit a playbook: raise it with Rory instead.

The public exhbt and portfolio pages are a person's own pages, in their chosen look (decision 0018). Do not restyle them; check them for defects (contrast, overflow, keyboard, states) only.

## Which playbook

| Job | Read |
|---|---|
| Code-level quality report (a11y, performance, theming, responsive) | `reference/audit.md` |
| Design critique with scores and personas | `reference/critique.md`, `reference/critique-rubric.md` |
| Final refinement pass on a screen | `reference/polish.md` |
| Baseline checks and patterns to refuse while building | `reference/craft-floor.md` |
| App screens: builder, result, dashboard, editor | `reference/operate.md` |
| Spacing, grouping, reading order | `reference/layout.md` |
| Type roles, measure, line breaks | `reference/typeset.md` |
| Long text, errors, empty and loading states | `reference/harden.md` |
| Phone, tablet, print, touch | `reference/adapt.md` |
| Labels, errors, helper text | `reference/clarify.md` |
| Too busy: remove | `reference/distill.md` |
| Too loud: calm down | `reference/quieter.md` |
| Too flat: one section needs more conviction | `reference/bolder.md` |
| Moments of character | `reference/delight.md` |
| Motion and its reduced-motion path | `reference/animate.md` |
| Technically ambitious effects (propose first) | `reference/overdrive.md` |
| First use and empty states | `reference/onboard.md` |
| Speed and Core Web Vitals | `reference/optimize.md` |

## Modes

The playbooks scale advice by mode. `DESIGN.md` sets Exhbt's: **Persuade** (the visitor decides and acts: Home, Pricing, Universities), **Read** (the visitor understands: How to read an exhbt, Legal), **Operate** (the visitor does a task: builder, result, dashboard, editor, admin). **Experience** (the visitor is inside the work) is the portfolio and exhbt pages, which are not restyled.

## Left out

The launcher, the detector, hooks and live mode are left out on purpose. Do not install or run them. The same goes for the upstream `init`, `document`, `extract` and `live` commands, report storage and any Impeccable account. Where a playbook says "ask the user" and you are a subagent, return the question to whoever briefed you.

Gather evidence with the repository's own tools (Playwright, the e2e specs, `npm run check`), as `AGENTS.md` says.
