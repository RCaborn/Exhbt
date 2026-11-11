Status: accepted
Date: 9 Nov 2026
Supersedes: the email step in `docs/decisions/0003-cv-step-and-skill-radar.md` (the builder's step 4)

# The radar is free; the email opens the project ideas, and three ideas become the plan

This follows Rory's wireframe: job, personal details, strengths and weaknesses with the radar, then the projects page, where ideas can be tweaked and the result is the plan.

## Where the email is asked for

Rory asked for whatever converts best. The choice: show the roadmap, radar included, **without** an email, and ask for it right before the project ideas.

- The builder is three steps: the job, the CV (skippable), and where you are now with education and skills. "See my roadmap" builds it straight away.
- The Gaps screen (the radar with "Level up next" and "In the bag") and "Already strong" need no email. The views run Overview, Gaps, Already strong, Projects, What next, so everything free comes before the gate.
- Projects shows the gate until there's an email. It asks for a name and an email, with LinkedIn optional, plus the marketing opt-in and the terms line. There's no way past it except filling it in.
- The fields are prefilled from the CV where they can be read (`lib/cv-contact.ts`: the first lines for the name, plus any email and linkedin.com/in address), and they can always be edited. Nothing is lifted by AI.
- The roadmap email goes out when the gate is filled in. The free monthly limit is checked there too, now that the email is known. Someone signed in has an email already, so they skip the gate and the limit applies at the builder.
- The name and LinkedIn sit on the roadmap until sign-in copies them to the profile, as the email and the opt-in already did.

Why this order: the radar is the first thing that's about them. Asking after it means asking once they've seen value and want the next part, and the prefill makes the ask one click for most people. This is a judgement, not a measured result. The events `projects_gate_viewed`, `projects_unlocked` (with whether it was prefilled), `project_swapped` and `plan_kept` are logged so it can be checked against real use.

## The plan of three

- A roadmap starts with three project ideas, its plan. The roadmap prompt asks for exactly three.
- Each idea has a **Swap** button that replaces that one idea and leaves the other two. The new idea is asked to differ from the two being kept, so the mix stays varied.
- The optional "Make some tweaks" note (e.g. "use more real data") steers each swap. It's a preference about the projects, never a fact about the person. The facts-only rule still holds (`lib/ai/projects.ts`).
- Swaps per idea come from `projectSwapsPerIdea` in `lib/entitlements.ts`. Free launch: 5 regenerations of each of the three suggestions (Rory, 11 Nov).
- When the swaps run out, or they press "Keep this plan", the page becomes **Your plan** and stops changing. The after-projects radar follows the plan.
- Ideas live in their own table (`project_ideas`), not in the roadmap output, because roadmap outputs are shared between identical requests by the cache. A swap is one person's.

What comes next: the plan feeds the exhbt editor ("Exhbt AI" on the wireframe), which isn't built yet.
