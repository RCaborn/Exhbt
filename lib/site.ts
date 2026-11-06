/**
 * Site-wide launch state. The site is a PRIVATE PREVIEW unless a build sets
 * EXHBT_PUBLIC=1: pages are noindex, robots.txt disallows everything, and a bar
 * says it's a preview. Fail-safe: forgetting a setting keeps the site hidden.
 *
 * The value is fixed at build time (inlined via next.config.ts `env`), so static
 * pages and runtime code always agree.
 */
export const isPublicLaunch = process.env.EXHBT_PUBLIC === "1";
export const isPrivatePreview = !isPublicLaunch;
