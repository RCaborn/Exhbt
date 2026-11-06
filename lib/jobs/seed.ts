import type { JobProfile } from "./index";

/**
 * A handful of example roles so the jobs lookup works before the real dataset
 * (~3,000 UK roles with required skills) is imported with scripts/import-jobs.mjs.
 * Skills here are illustrative placeholders, not taken from an authoritative source:
 * replace them by importing the real dataset.
 */
export const SEED_JOBS: JobProfile[] = [
  {
    id: "seed-data-analyst",
    title: "Data analyst",
    altTitles: ["junior data analyst", "business intelligence analyst", "insight analyst", "reporting analyst"],
    skills: ["SQL", "Excel", "Data visualisation", "Python or R", "Statistics", "Dashboards (Power BI or Tableau)", "Communicating findings"],
    source: "seed",
  },
  {
    id: "seed-software-developer",
    title: "Software developer",
    altTitles: ["software engineer", "web developer", "junior developer", "graduate software engineer"],
    skills: ["A programming language (e.g. JavaScript, Python, Java)", "Version control (Git)", "Testing", "Databases", "Problem solving", "Code review"],
    source: "seed",
  },
  {
    id: "seed-marketing-executive",
    title: "Marketing executive",
    altTitles: ["digital marketing executive", "marketing assistant", "social media executive", "content marketer"],
    skills: ["Copywriting", "Social media", "Campaign planning", "Analytics (e.g. GA4)", "SEO basics", "Budget tracking"],
    source: "seed",
  },
  {
    id: "seed-ux-researcher",
    title: "UX researcher",
    altTitles: ["user researcher", "ux designer", "product designer", "service designer"],
    skills: ["Interviewing users", "Usability testing", "Synthesising research", "Prototyping", "Accessibility", "Presenting findings"],
    source: "seed",
  },
  {
    id: "seed-financial-analyst",
    title: "Financial analyst",
    altTitles: ["graduate finance analyst", "fp&a analyst", "investment analyst", "accountant"],
    skills: ["Financial modelling", "Excel", "Accounting principles", "Forecasting", "Attention to detail", "Reporting"],
    source: "seed",
  },
  {
    id: "seed-policy-officer",
    title: "Policy officer",
    altTitles: ["policy analyst", "researcher", "civil service fast stream", "public affairs"],
    skills: ["Research and analysis", "Writing briefings", "Stakeholder engagement", "Evidence appraisal", "Project management"],
    source: "seed",
  },
];
