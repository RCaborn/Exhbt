/**
 * The "where roadmaps come from" line. It only claims the dataset once it's real:
 * set NEXT_PUBLIC_JOBS_DATASET_ROLES (a build variable in Cloudflare) to the number of
 * roles imported by scripts/import-jobs.mjs, which prints the value to use. Below
 * 1,000 roles, or unset, the site uses the modest fallback.
 */
const roles = Number(process.env.NEXT_PUBLIC_JOBS_DATASET_ROLES || 0);

export const JOBS_DATASET_LOADED = roles >= 1000;

export const SOURCING_LINE = JOBS_DATASET_LOADED
  ? `We’ve read ${roles.toLocaleString("en-GB")} UK job profiles so you don’t have to.`
  : "Built around the skills UK employers actually ask for.";
