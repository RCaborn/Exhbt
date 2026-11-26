<!-- From pbakaus/impeccable at 2fc5e14 (Apache-2.0), changed for Exhbt: see ../SOURCE.md. -->

### Purpose

Resolve one stable target, run two independent assessments, synthesize a design critique, and ask the user what to improve next. The chat response is the deliverable.

### Hard Invariants

- Assessment A (design review) and Assessment B (rendered evidence) are both required.
- When a sub-agent tool is available, run A and B as two isolated sub-agents. When it is not, run A first and B second in this context, and say so in the report header (see Report header provenance).
- Assessment A must finish before B's evidence enters the synthesis. Mechanical evidence anchors judgment.
- Viewable targets require a look at the rendered page when a browser is available.
- Any local server started only for the critique must run in the background, have a recorded stop method, and be stopped before final reporting unless the user asks to keep it.
- The question is the LAST thing in the response. Write the entire report out first, then ask; nothing follows the question.
- A run that ends with neither the targeted questions nor a literal `Questions skipped: <reason>` line is an incomplete run. The report is not the finish; the close is.

### Setup

1. **Resolve the target** to a concrete file path or URL. Prefer a source path over a dev-server URL when both identify the same surface; ports drift, paths do not.
   - "the homepage" -> `app/page.tsx`
   - "the settings modal" -> the primary component file
   - "this page" -> the current URL or source file

### Assessment Orchestration

Delegate Assessment A and Assessment B to separate sub-agents when you can. They must not see each other's output. Do not show findings to the user until synthesis.

**Read-only or delegated run.** When this critique runs where it cannot spawn agents or ask anyone (a delegated subagent, CI, a headless call), run Assessment A inline, then Assessment B, lead the report with `Method: single-context (delegated read-only run)`, and put `Questions skipped: delegated run` in place of Ask the User.

If browser automation is available, each assessment opens its own new page or tab. Never reuse an existing one, even if it is already at the right URL.

### Assessment A: Design Review

Read relevant source files and visually inspect the live page when browser automation is available. Think like a design director.

Evaluate:
- **Design specificity**: Is the composition, interaction, and visual language grounded in this product, or could an unrelated product use it unchanged? Make this judgment before seeing Assessment B's evidence.
- **Holistic design**: hierarchy, IA, emotional fit, discoverability, composition, typography, color, accessibility, states, copy, and edge cases.
- **Cognitive load**: consult the Cognitive Load Assessment in [critique-rubric.md](critique-rubric.md); report checklist failures and decision points with >4 visible options.
- **Emotional journey**: peak-end rule, emotional valleys, reassurance at high-stakes moments.
- **Nielsen heuristics**: consult the Heuristics Scoring Guide in [critique-rubric.md](critique-rubric.md); score all 10 heuristics 0-4, marking any heuristic the mode-applicability rule allows as `n/a` instead of forcing a number.

- **Persona red flags**: select personas with the Selecting Personas table in [critique-rubric.md](critique-rubric.md), plus 1-2 project-specific ones from the audience the project documents (on Exhbt, `PRODUCT.md` and `AGENTS.md`), and walk each through the primary action.

Read critique-rubric.md as part of Assessment A. When a sub-agent runs A, give it the file's path so it reads the rubric itself, and the parent does not load it. When A runs in this context, read the rubric here before scoring.

Return: design-specificity verdict, heuristic scores, cognitive load, emotional journey, 2-3 strengths, 3-5 priority issues, persona red flags, minor observations, and provocative questions.

### Assessment B: Rendered Evidence

Gather the mechanical evidence with the project's own tools. On web, Assessment B is mandatory and must remain isolated from Assessment A until both are complete.

- Screenshots of the target at a phone width (390x844) and a wide desktop width, taken with the project's own browser tooling (on Exhbt, Playwright).
- The project's accessibility checks on the target (on Exhbt, the axe run in `e2e/a11y.spec.ts`), plus computed contrast for text that sits on a colour.
- A keyboard-only pass through the primary action: focus order, visible focus, traps.
- Overflow and wrapping at the narrow width, and the loading, empty and error states the target can reach.

Report an empty result with what was checked (files, URLs, viewports), never as clean: these checks do not judge layout or hierarchy.

Use a localhost dev or production server for local files; avoid `file://`.

Return: findings with counts and locations, false positives, and skipped or failed steps with concrete reasons.

### Generate Combined Critique Report

Synthesize both assessments into a single report. Do not simply concatenate. Weave the findings together, noting where the design review and the rendered evidence agree, where the evidence caught issues the review missed, and where evidence findings are false positives.

The chat response is the user-facing deliverable. Present the full structured critique below in chat; do not replace it with a summary and a link.

Structure your feedback as a design director would:

#### Report header provenance

The report's first line declares how the assessments were run:
- Dual-agent: `Method: dual-agent (A: <agent-id> · B: <agent-id>)`
- Single context: `Method: single-context (<reason, e.g. no sub-agent tool exposed>)`

#### Design Health Score
> *Use Assessment A's scores; the bands are under [Scoring the report](#scoring-the-report) below.*

Present the Nielsen's 10 heuristics scores as a table:

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | ? | [specific finding or "n/a" if solid] |
| 2 | Match System / Real World | ? | |
| 3 | User Control and Freedom | ? | |
| 4 | Consistency and Standards | ? | |
| 5 | Error Prevention | ? | |
| 6 | Recognition Rather Than Recall | ? | |
| 7 | Flexibility and Efficiency | ? | |
| 8 | Aesthetic and Minimalist Design | ? | |
| 9 | Error Recovery | ? | |
| 10 | Help and Documentation | ? | |
| **Total** | | **??/[applicable max]** | **[Rating band]** |

The applicable maximum is 4 times the number of heuristics you actually scored: **/40** when all ten apply, **/32** when two are `n/a`. Never print `/40` over a partial set.

Be honest with scores. A 4 means genuinely excellent. Most real interfaces score 20-32 out of 40.

**Mode applicability**: heuristics 7 (Flexibility and Efficiency) and 10 (Help and Documentation) may be scored `n/a` on Persuade and Experience surfaces (landing pages, campaigns, portfolios, bodies of work), as may any other heuristic that genuinely cannot apply to the surface under review. Write `n/a` in the Score cell with a one-line reason, and renormalize the total to the applicable maximum (e.g. **24/32** when two heuristics are n/a) so the rating band stays proportional. The report states the applicable maximum and which heuristics were scored n/a.

#### Design Specificity Verdict

**Start here.** Does the result feel authored for this product, or category-interchangeable?

**LLM assessment**: Your unanchored evaluation of design specificity. Cover overall coherence, structural sameness, category-interchangeable choices, and missed opportunities for product character.

**Rendered evidence**: Summarize what Assessment B found, with counts and file locations. Note any issues it caught that the design review missed, and flag any false positives.

#### Overall Impression
A brief gut reaction: what works, what doesn't, and the single biggest opportunity.

#### What's Working
Highlight 2-3 things done well. Be specific about why they work.

#### Priority Issues
The 3-5 most impactful design problems, ordered by importance.

For each issue, tag with **P0-P3 severity** (see [Issue Severity below](#issue-severity-p0p3) for definitions):
- **[P?] What**: Name the problem clearly
- **Why it matters**: How this hurts users or undermines goals
- **Fix**: What to do about it (be concrete)
- **Suggested playbook**: Which playbook could address this (from: adapt, animate, audit, bolder, clarify, critique, delight, distill, harden, layout, onboard, optimize, overdrive, polish, quieter, typeset)

#### Persona Red Flags
> *Use Assessment A's persona red flags; it selected the personas from [critique-rubric.md](critique-rubric.md).*

Assessment A selected 2-3 personas most relevant to this interface type (the selection table in critique-rubric.md). If the project documents its users (on Exhbt, `PRODUCT.md`), also generate 1-2 project-specific personas from that.

For each selected persona, walk through the primary user action and list specific red flags found:

**Alex (Power User)**: No keyboard shortcuts detected. Form requires 8 clicks for primary action. Forced modal onboarding. High abandonment risk.

**Jordan (First-Timer)**: Icon-only nav in sidebar. Technical jargon in error messages ("404 Not Found"). No visible help. Will abandon at step 2.

Be specific. Name the exact elements and interactions that fail each persona. Don't write generic persona descriptions; write what broke for them.

#### Minor Observations
Quick notes on smaller issues worth addressing.

#### Questions to Consider
Provocative questions that might unlock better solutions:
- "What if the primary action were more prominent?"
- "Does this need to feel this complex?"
- "What would a confident version of this look like?"

**Remember**:
- Be direct. Vague feedback wastes everyone's time.
- Be specific. "The submit button," not "some elements."
- Say what's wrong AND why it matters to users.
- Give concrete suggestions. Cut "consider exploring..." entirely.
- Prioritize ruthlessly. If everything is important, nothing is.
- Don't soften criticism. Developers need honest feedback to ship great design.

### Deliver the Report

Write the full report into the chat response, then close the run with Ask the User below. Nothing is saved outside the chat.

### Ask the User

**After presenting findings**, use targeted questions based on what was actually found. Ask the user and wait for the answer before continuing (a subagent hands the question back to whoever briefed it). These answers will shape the action plan.

Ask in the same message that carries the report, with the report written out first and the question last. Do not split the two across turns: a turn that ends on the report is a turn that ends, and the questions never arrive. Order within the message is what matters, because prose emitted after a structured question is withheld until the user answers.

Ask questions along these lines (adapt to the specific findings; do not ask generic questions):

1. **Priority direction**: Based on the issues found, ask which category matters most to the user right now. For example: "I found problems with visual hierarchy, color usage, and information overload. Which area should we tackle first?" Offer the top 2-3 issue categories as options.

2. **Design intent**: If the critique found a tonal mismatch, ask whether it was intentional. For example: "The interface feels clinical and corporate. Is that the intended tone, or should it feel warmer/bolder/more playful?" Offer 2-3 tonal directions as options based on what would fix the issues found.

3. **Scope**: Ask how much the user wants to take on. For example: "I found N issues. Want to address everything, or focus on the top 3?" Offer scope options like "Top 3 only", "All issues", "Critical issues only".

4. **Constraints** (optional; only ask if relevant): If the findings touch many areas, ask if anything is off-limits. For example: "Should any sections stay as-is?" This prevents the plan from touching things the user considers done.

**Rules for questions**:
- Every question must reference specific findings from the report. Never ask generic "who is your audience?" questions.
- Keep it to 2-4 questions maximum. Respect the user's time.
- Offer concrete options, not open-ended prompts.
- Skipping is allowed only when the report listed **fewer than 3 Priority Issues**, or on a read-only or delegated run. Count them; do not judge the findings "straightforward" by feel. At 3 or more on an interactive run, the questions are required.

**Final-question gate.** The user-visible response must either include the targeted questions or carry the literal line `Questions skipped: <reason>` naming the count or the delegated run that permitted the skip. Each question must include 2-3 concrete answer options tied to the actual critique findings. Do not end with only open-ended questions, and do not end with neither: stopping after the report, having asked nothing and printed no skip line, is the most common way this command fails.

### Recommended Actions

**After receiving the user's answers**, present a prioritized action summary reflecting the user's priorities and scope from Ask the User.

#### Action Summary

List recommended playbooks in priority order, based on the user's answers:

1. **`playbook`**: Brief description of what to fix (specific context from critique findings)
2. **`playbook`**: Brief description (specific context)
...

**Rules for recommendations**:
- Only recommend playbooks from: adapt, animate, audit, bolder, clarify, critique, delight, distill, harden, layout, onboard, optimize, overdrive, polish, quieter, typeset
- Order by the user's stated priorities first, then by impact
- Each item's description should carry enough context that the playbook run knows what to focus on
- Map each Priority Issue to the appropriate playbook
- Skip playbooks that would address zero issues
- If the user chose a limited scope, only include items within that scope
- If the user marked areas as off-limits, exclude playbooks that would touch those areas
- End with polish as the final step if any fixes were recommended

After presenting the summary, tell the user:

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Run the critique again after fixes to see the score move.

---

## Reference Material

Assessment A scores against [critique-rubric.md](critique-rubric.md): the cognitive load checklist, the heuristic scoring guide, and the personas. The report uses the bands and severities below.

### Scoring the report

#### Score Summary

**Total possible**: 40 points (10 heuristics × 4 max)

| Score Range | Rating | What It Means |
|-------------|--------|---------------|
| 36–40 | Excellent | Minor polish only; ship it |
| 28–35 | Good | Address weak areas, solid foundation |
| 20–27 | Acceptable | Significant improvements needed before users are happy |
| 12–19 | Poor | Major UX overhaul required; core experience broken |
| 0–11 | Critical | Redesign needed; unusable in current state |

When heuristics were scored `n/a`, the maximum is lower than 40; read the band off the percentage instead of the raw number (90%+ Excellent, 70%+ Good, 50%+ Acceptable, 30%+ Poor, below that Critical). 24/32 is 75%, so Good.

---

#### Issue Severity (P0–P3)

Tag each individual issue found during scoring with a priority level:

| Priority | Name | Description | Action |
|----------|------|-------------|--------|
| **P0** | Blocking | Prevents task completion entirely | Fix immediately; this is a showstopper |
| **P1** | Major | Causes significant difficulty or confusion | Fix before release |
| **P2** | Minor | Annoyance, but workaround exists | Fix in next pass |
| **P3** | Polish | Nice-to-fix, no real user impact | Fix if time permits |

**Tip**: If you're unsure between two levels, ask: "Would a user contact support about this?" If yes, it's at least P1.
