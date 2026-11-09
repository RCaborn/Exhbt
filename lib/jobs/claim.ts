/**
 * The "where roadmaps come from" line. It only claims the dataset once it's real:
 * set NEXT_PUBLIC_JOBS_DATASET_ROLES (a build variable in Cloudflare) to the number of
 * roles imported by scripts/import-jobs.mjs, which prints the value to use. Below
 * 1,000 roles, or unset, the site uses the modest fallback.
 */
const roles = Number(process.env.NEXT_PUBLIC_JOBS_DATASET_ROLES || 0);

export const JOBS_DATASET_LOADED = roles >= 1000;

/**
 * Under every skill radar. Until real job-advert data is loaded, the skills and the
 * "needed" levels are the AI's picks and must say so (docs/decisions/0003).
 * Once loaded, this can name the data; the wording then needs reviewing with the import.
 */
export const SKILLS_SOURCE_NOTE = JOBS_DATASET_LOADED
  ? `Skills from ${roles.toLocaleString("en-GB")} UK job profiles. Your levels are estimates from what you told us.`
  : "Skills picked by AI from what this kind of job usually asks for. Your levels are estimates from what you told us.";

export const SOURCING_LINE = JOBS_DATASET_LOADED
  ? `We’ve read ${roles.toLocaleString("en-GB")} UK job profiles so you don’t have to.`
  : "Built around the skills UK employers actually ask for.";
