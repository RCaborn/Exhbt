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

## Update, 16 Nov 2026: yearly billing

The founders set the prices: Premium £9 a year, Max £15 a year, one payment a year, renewing until cancelled. The figure and the period live in `lib/entitlements.ts` (`PRICES`, `BILLING_PERIOD`). The two Stripe prices are yearly recurring prices (`LAUNCH.md`); the checkout code sets no interval of its own. Roadmap refreshes remain a rolling 30-day allowance, which is a usage limit and not the billing period.
