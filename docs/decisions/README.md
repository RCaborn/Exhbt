# Decisions

One file per decision. The newest accepted file wins. When a decision changes, add a new file and set the old one's status to `superseded`. Do not edit the figures into a second doc.

Plan figures live in `lib/entitlements.ts`. Hosts live in `lib/hosts.ts`. The one-page picture is `docs/MAP.md`. `docs/PLAN.md` is the old Terna-era plan and is not current.

Each file starts with:

```
Status: accepted
Date: 8 Nov 2026
```

`npm run check:docs` fails if living prose restates a plan count, brings back the retired name for an exhbt, or describes a portfolio as a path under the apex.
