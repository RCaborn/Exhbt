Status: accepted
Date: 12 Nov 2026
Supersedes: 0002 (names, and Free's public portfolio)

# Free, Premium, Max

The paid tiers are renamed, and Free no longer gets a public page.

| Plan | Exhbts | Public portfolio (alex.exhbt.co.uk) | Per-job links |
|---|---|---|---|
| Free | 1, build and preview only | no | no |
| Premium (first paid tier, was Plus) | 4 | yes | no |
| Max (was Pro) | 10 | yes | yes, the best-fit set |
| Universities | as Max | yes | yes |

Why Free has no public page: the portfolio is what people pay for. Free still lets someone draft and preview one exhbt, so they see the product working before paying.

Stored keys follow the names: `free`, `premium`, `max`, `institutional`. Nobody had paid when this changed, so one migration remaps the old values (`premium` to `max`, then `plus` to `premium`). Roadmap refreshes and project swaps keep their figures under the new keys.

Prices are not set. Figures above are a record; the code wins (`lib/entitlements.ts`).
