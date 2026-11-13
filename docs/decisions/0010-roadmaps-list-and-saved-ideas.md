Status: accepted
Date: 17 Nov 2026

# A list of roadmaps, and saved ideas on paid plans

Someone changing career builds a roadmap for the new job, and wants to keep ideas from the old one. Every roadmap was already stored, but `/roadmap` redirected to the latest, so earlier ones could not be reached.

- `/roadmap` is now a list of the person's roadmaps, newest first, for every plan. It never redirects when there is one roadmap: the header's "Roadmaps" link and the "new roadmap for a different job" form both live on this page. With none, it goes to the builder.
- "New roadmap for a different job" asks only for the job and reuses the newest roadmap's situation, education, skills and CV text. It runs the builder's own checks (`lib/roadmap-create.ts`): the plan's `roadmapsPer30Days` and the per-connection guard.
- Saved ideas are a paid feature (`savedIdeas` in `lib/entitlements.ts`). A saved idea is a copy of the title, brief, gaps, deliverable and weeks, with the roadmap and the job it came from, so a swap or a deleted roadmap never changes it. The list is `/roadmap/saved`, filterable by job, with "Build this as an exhbt" and "Remove".
- Free people see a locked star that shows the upgrade offer. Nothing about their roadmap changes.
- A person's list holds `SAVED_IDEAS_CAP` ideas (`lib/store.ts`), enforced in code. It is an abuse guard, not a plan figure.
- The project-ideas gate and the builder now check the limit of the person's own plan, not Free's, when they are signed in.
