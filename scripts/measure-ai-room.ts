/**
 * How much of its max_tokens each AI call uses, and whether the app can read the answer (decision
 * 0029 has why this matters). Sends the app's own request for every feature, built by the request
 * builder beside each call, with a typical and a heavy input, three times each, and reads each
 * answer the way the app does: structured answers through structuredCall (stop reason, then JSON,
 * the repair and the strict schema), transcriptions through readTranscript. Prints one table: the
 * cap, the stop reasons, how the reading went, the output tokens (thinking included), the thinking
 * tokens and the seconds each call took.
 *
 *   npm run measure:ai                 # everything, 3 runs per case
 *   npm run measure:ai -- --runs 1     # quicker
 *   npm run measure:ai -- --only draft,roadmap
 *   npm run measure:ai -- --dry        # no API calls: each request's cap and size
 *
 * Every form but --dry calls the real API and is paid for: 84 calls, about 15 US cents, for the
 * whole run. Nothing runs this script automatically: no push, pull request, deploy or schedule. It
 * is run by hand (.github/workflows/ai-shapes.yml, or here), with the owner's say-so, the cost
 * stated first (decision 0029).
 *
 * Inputs: the draft eval's fixtures (evals/exhbt-draft/fixtures) read the way the browser reads
 * them; page thumbnails of those PDFs (evals/ai-room/pages, made like the browser's: 768 px long
 * edge, JPEG quality 0.72); scans with no text layer (evals/ai-room/scans); and the CVs, jobs and
 * portfolios below. What "heavy" means, truthfully:
 * - at the app's maximum: the roadmap's every field (ROADMAP_INPUT_MAX), the draft's and the
 *   rewrite's material (MAX_MATERIAL_CHARS), the listing (MAX_LISTING_CHARS), 10 candidates
 *   (the Max plan's exhbts) each with LIMITS' most findings and skills, 30 page images
 *   (FIGURE.maxImages) and the intro's CV (MAX_CV_CHARS);
 * - not at the maximum: the 30 page images are 8 distinct pages used in turn; the heavy scans are
 *   a 6-page CV and a 12-page report, not the largest file a plan allows; and the intro's "heavy"
 *   case is every fact filled in, which the model answers quickly; its sparse case thinks longest.
 * Exits non-zero if any answer couldn't be read as the app reads it (cut off, wrong shape, refused,
 * a service error). A transcription cut off is not a failure: the page tells the person only the
 * first part was read. Never prints the key or the environment.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod/v4";
import { AIFailure, structuredCall, type AIFeature } from "@/lib/ai/call";
import { draftRequest, materialText, MAX_MATERIAL_CHARS, type DraftInput } from "@/lib/ai/exhbt-draft";
import { DraftSchema, repairDraft } from "@/lib/ai/draft-answer";
import { rewriteRequest, SCHEMAS } from "@/lib/ai/exhbt-rewrite";
import { AnswerSchema, figurePickRequest, type PageImage } from "@/lib/ai/figure-pick";
import { jobMatchRequest, MatchSchema } from "@/lib/ai/job-match";
import { IntroSchema, introRequest, MAX_CV_CHARS, type IntroFacts } from "@/lib/ai/portfolio-intro";
import { ideasRequest, IdeasSchema, swapRequest, SwapSchema } from "@/lib/ai/projects";
import { repairIdeas, repairRoadmap, repairSwap } from "@/lib/ai/repair";
import { roadmapRequest } from "@/lib/ai/roadmap";
import { ROADMAP_INPUT_MAX, RoadmapModelSchema, type Project, type Roadmap, type RoadmapInput } from "@/lib/ai/schemas";
import { readTranscript, transcribeRequest } from "@/lib/ai/transcribe";
import { anthropicApiKey, costUsd } from "@/lib/ai/model";
import { extractTextInBrowser } from "@/lib/doc-readers";
import { ENTITLEMENTS, EXHBTS_PER_JOB_LINK } from "@/lib/entitlements";
import { LIMITS } from "@/lib/exhbt/blocks";
import { DRAFT_BLOCKS } from "@/lib/exhbt/draft-blocks";
import { fullDoc, openBankingDoc } from "@/lib/exhbt/sample";
import type { JobProfile } from "@/lib/jobs";
import type { MatchCandidate } from "@/lib/jobs/rank";
import { MAX_LISTING_CHARS } from "@/lib/jobs/listing-text";
import { FIGURE } from "@/lib/figures/rules";
import { imageSize } from "@/lib/figures/image-size";
import { PLAN_SIZE } from "@/lib/store";

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "evals/exhbt-draft/fixtures");
const PAGES = join(ROOT, "evals/ai-room/pages");
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  md: "text/markdown",
  txt: "text/plain",
};

// ---------------------------------------------------------------------------------------------
// Inputs

async function fixtureInput(name: string): Promise<DraftInput> {
  const f = JSON.parse(readFileSync(join(FIXTURES, `${name}.facts.json`), "utf8")) as { files: string[]; notesFile: string | null; link: string | null };
  const parts: string[] = [];
  for (const file of f.files) {
    const bytes = readFileSync(join(FIXTURES, file));
    const ext = file.split(".").pop() ?? "";
    parts.push(`File: ${file}\n${await extractTextInBrowser(new File([new Uint8Array(bytes)], file, { type: MIME[ext] ?? "" }))}`);
  }
  const notes = f.notesFile ? readFileSync(join(FIXTURES, f.notesFile), "utf8").trim() : undefined;
  return { text: parts.join("\n\n"), notes, link: f.link ?? undefined };
}

/** Every fixture's material one after another, up to the most the app reads: the heaviest material. */
async function heaviestMaterial(): Promise<string> {
  const names = readdirSync(FIXTURES).filter((n) => n.endsWith(".facts.json")).map((n) => n.replace(".facts.json", "")).sort();
  const texts = await Promise.all(names.map(async (n) => materialText(await fixtureInput(n))));
  let all = texts.join("\n\n");
  while (all.length < MAX_MATERIAL_CHARS) all += `\n\n${texts.join("\n\n")}`;
  return all.slice(0, MAX_MATERIAL_CHARS);
}

const TYPICAL_CV = `Priya Shah
Leeds | priya.shah@example.com

Profile
Final-year BSc Economics student at the University of Leeds who enjoys turning messy data into clear answers. Looking for a graduate analyst role.

Education
University of Leeds, BSc Economics, 2023 to 2026. Predicted 2:1.
Modules: Econometrics 1 and 2, Microeconomics, Labour Economics, Data Analysis in R, Public Policy Evaluation.
Dissertation: distance to the nearest campus and entry to higher education, using a linear probability model on 4,812 pupils.

Experience
Data intern, Leeds City Council, summer 2025. Cleaned three years of housing-repair records in Excel and built a pivot-table dashboard the team still uses. Cut the monthly report from two days to half a day.
Sales assistant, Boots, 2022 to 2024, part time. Handled the till and stock counts; trained two new starters.

Skills
R (tidyverse, ggplot2), Excel (pivot tables, XLOOKUP), basic Python (pandas), Stata, SQL (SELECT and JOIN), PowerPoint.

Other
Treasurer, Economics Society, 2024 to 2025: ran a budget of £3,200 and the society's first alumni panel.`;

/** A long CV, near the 20,000 characters the builder takes: many roles, modules and projects, each different. */
function longCv(): string {
  const roles = [
    ["Data analyst intern", "NHS Leeds Teaching Hospitals", "summer 2025", "Built an R script that joined outpatient bookings to clinic capacity and showed which clinics overbooked on Mondays; the operations team moved 14 slots a week as a result."],
    ["Research assistant", "University of Leeds School of Economics", "2024 to 2025", "Coded 1,200 local authority budget lines into a panel for a lecturer's paper on library closures, and checked every figure against the published accounts."],
    ["Insight volunteer", "Leeds Food Aid Network", "2023 to 2025", "Designed a sign-in sheet and a monthly summary that showed visits rising from 180 to 290 a month, used in two funding bids."],
    ["Retail supervisor", "Boots, Briggate", "2021 to 2024", "Ran the evening shift for a team of six, counted stock, and cut the weekly stock discrepancy from about 3% to under 1% by changing the order of the count."],
    ["Tutor", "Tutor Trust", "2023 to 2024", "Taught GCSE maths to groups of four in two Leeds schools; eight of eleven pupils moved up at least one grade by the mock."],
    ["Summer analyst", "Yorkshire Building Society", "summer 2024", "Tested whether mortgage arrears letters sent on a Friday were answered later than others, using two years of contact data and a simple logistic regression."],
    ["Events officer", "Economics Society", "2024 to 2025", "Organised eleven talks and an alumni panel of five speakers; attendance averaged 64."],
    ["Peer mentor", "University of Leeds", "2024 to 2026", "Met three first-year students every fortnight to help with study planning and the first econometrics problem sets."],
  ];
  const modules = [
    "Econometrics 1 (78): OLS, heteroskedasticity, instrumental variables",
    "Econometrics 2 (74): panel data, fixed effects, difference in differences",
    "Labour Economics (71): minimum wages, returns to education",
    "Public Policy Evaluation (76): randomised trials, regression discontinuity",
    "Data Analysis in R (82): tidyverse, ggplot2, reproducible reports",
    "Microeconomics 2 (68): game theory, contracts",
    "Macroeconomics 2 (65): growth, monetary policy",
    "Development Economics (70): microfinance, cash transfers",
    "Environmental Economics (72): carbon pricing, cost-benefit analysis",
    "Mathematics for Economists (69): optimisation, matrices",
    "Behavioural Economics (73): nudges, present bias",
    "Health Economics (75): QALYs, waiting lists",
  ];
  const projects = [
    "Dissertation: distance to the nearest campus and entry to higher education by age 19, a linear probability model on 4,812 pupils with local authority fixed effects; an extra 10 km is linked to 3.1 percentage points lower entry.",
    "Group project: forecasting weekly demand for a student union cafe from till data with a seasonal naive model and exponential smoothing; the better model cut the mean absolute error by a fifth.",
    "Data science coursework: predicting late grocery deliveries with logistic regression and LightGBM on 18,000 orders; recall for late orders rose from 0.62 to 0.79.",
    "Policy brief: what a £1 rise in the minimum wage would mean for hours worked in Yorkshire hospitality, using Annual Survey of Hours and Earnings tables.",
    "Personal project: a Shiny app that maps Leeds bus punctuality from the open data feed, updated nightly.",
    "Hackathon: a 24-hour build of a budgeting tool for students in Python, placed second of 19 teams.",
    "Case competition: a market-entry case for a plant-based food brand, presented to a panel from a consultancy.",
    "Essay prize entry: the effect of free school meals on attendance, using a published panel.",
  ];
  const skills = [
    "R: tidyverse, ggplot2, fixest, Shiny, R Markdown",
    "Python: pandas, scikit-learn, LightGBM, matplotlib",
    "SQL: joins, window functions, CTEs (PostgreSQL)",
    "Stata: panel regressions, esttab",
    "Excel: pivot tables, Power Query, XLOOKUP, charts",
    "Git and GitHub for coursework and the Shiny app",
    "Writing: policy briefs, a 10,000-word dissertation",
    "Presenting: society talks, a case competition final",
  ];
  const parts: string[] = [
    "Priya Shah\nLeeds | priya.shah@example.com | github.com/priya-shah-example",
    "Profile\nFinal-year BSc Economics student at the University of Leeds who likes turning messy public data into clear, checked answers. I want a graduate data or policy analyst role where the work changes a decision.",
    "Education\nUniversity of Leeds, BSc Economics, 2023 to 2026, predicted First.\nLeeds City College, A levels 2021 to 2023: Mathematics A*, Economics A, Geography A.",
    `Modules\n${modules.map((m) => `- ${m}`).join("\n")}`,
    `Experience\n${roles.map(([r, o, d, t]) => `${r}, ${o}, ${d}\n- ${t}`).join("\n\n")}`,
    `Projects\n${projects.map((p) => `- ${p}`).join("\n")}`,
    `Skills\n${skills.map((s) => `- ${s}`).join("\n")}`,
  ];
  // Then the detail a long CV carries: a line per week of the dissertation log and the tutoring notes,
  // each different, until the CV is near the builder's limit.
  const extra: string[] = [];
  for (let w = 1; extra.join("\n").length + parts.join("\n\n").length < 19_000; w++) {
    extra.push(`- Week ${w}: ${["read", "coded", "checked", "wrote up", "presented"][w % 5]} ${["the campus distances", "the pupil records", "the fixed-effects model", "the robustness checks", "the free school meals interaction", "the probit comparison", "the literature on distance", "the maps of campus openings"][w % 8]} (${8 + (w % 7)} hours, notes kept in the project log).`);
  }
  parts.push(`Dissertation log\n${extra.join("\n")}`);
  return parts.join("\n\n").slice(0, 20_000);
}

/** Real text cut to a field's maximum: the sentences in turn, as many times as it takes. */
function fill(sentences: string[], max: number): string {
  let s = "";
  for (let i = 0; s.length < max; i++) s += `${s ? " " : ""}${sentences[i % sentences.length]}`;
  return s.slice(0, max).trim();
}

const typicalRoadmapInput: RoadmapInput = {
  targetRole: "Graduate data analyst",
  cvText: TYPICAL_CV,
  situation: "at_university",
  situationDetail: "Final year, graduating in July",
  education: "BSc Economics, University of Leeds",
  skills: "R, Excel, some Python, SQL basics",
};
/** Every field of the builder filled to its maximum (ROADMAP_INPUT_MAX). */
const heavyRoadmapInput: RoadmapInput = {
  targetRole: fill(["Graduate policy and data analyst in the civil service or a think tank, working on education and labour market data,", "ideally in a team that links administrative records and writes briefings for ministers and senior officials,", "with a route into the Government Statistical Service"], ROADMAP_INPUT_MAX.targetRole),
  cvText: longCv().slice(0, ROADMAP_INPUT_MAX.cvText),
  situation: "at_university",
  situationDetail: fill(["Final year BSc Economics, graduating in July 2026.", "Open to London, Leeds or Sheffield.", "Can start in September and work a hybrid pattern."], ROADMAP_INPUT_MAX.situationDetail),
  education: fill([
    "BSc Economics, University of Leeds, 2023 to 2026, predicted First.",
    "A levels: Mathematics A*, Economics A, Geography A.",
    "Modules: Econometrics 1 and 2, Public Policy Evaluation, Labour Economics, Data Analysis in R, Health Economics, Development Economics, Environmental Economics.",
    "Dissertation: distance to the nearest campus and entry to higher education, 4,812 pupils, local authority fixed effects.",
    "Leeds City College, 2021 to 2023.",
  ], ROADMAP_INPUT_MAX.education),
  skills: fill([
    "R (tidyverse, fixest, Shiny, R Markdown).",
    "Python (pandas, scikit-learn, LightGBM, matplotlib).",
    "SQL (joins, window functions, CTEs in PostgreSQL).",
    "Stata (panel regressions, esttab).",
    "Excel (pivot tables, Power Query, XLOOKUP).",
    "Git and GitHub.",
    "Policy writing and presenting to non-specialists.",
  ], ROADMAP_INPUT_MAX.skills),
};
const typicalJob: JobProfile = { id: "data-analyst", title: "Data analyst", altTitles: [], skills: ["SQL", "Excel", "Data visualisation", "Statistics", "Communication"], source: "measure" };
const heavyJob: JobProfile = {
  id: "policy-analyst",
  title: "Policy analyst",
  altTitles: [],
  skills: ["Quantitative analysis", "Econometrics", "R or Python", "SQL", "Data visualisation", "Policy writing", "Stakeholder engagement", "Evaluation methods", "Cost-benefit analysis", "Survey design", "Presenting to senior audiences", "Project management", "Excel modelling", "Briefing ministers", "Handling sensitive data"],
  source: "measure",
};

function roadmapFor(job: JobProfile, heavy: boolean): Roadmap {
  const names = job.skills.slice(0, 6);
  return {
    targetRole: job.title,
    summary: "Strong on econometrics and R from the degree and the dissertation. Less shown on SQL at scale and on writing for a senior audience.",
    strengths: [{ skill: names[0]!, evidence: "Dissertation regression on 4,812 pupils." }],
    gaps: names.slice(0, heavy ? 6 : 3).map((skill, i) => ({ skill, whyItMatters: `The role uses ${skill.toLowerCase()} every week.`, currentEvidence: i % 2 ? "some" : "none" })),
    projects: [],
    skillMap: names.map((skill, i) => ({ skill, needed: [4, 3, 3, 2, 2, 1][i] ?? 1, current: i % 3, evidence: i % 3 ? "Named in a module." : "" })),
  };
}
const project = (title: string, gap: string): Project => ({ title, brief: `A short study that uses ${gap.toLowerCase()} on open UK data, written up for a policy reader.`, closesGaps: [gap], deliverable: "A four-page report and the code", weeks: 4 });

/** The person's published exhbts as the job match sees them. `full`: each with as many findings and skills as an exhbt holds (LIMITS). */
function candidates(n: number, full: boolean): MatchCandidate[] {
  const pool: MatchCandidate[] = [
    { id: "e1", title: "Does living further from a campus lower entry to higher education?", context: "BSc Economics dissertation", skills: ["Regression analysis", "R", "Panel data"], findings: ["An extra 10 km is linked to 3.1 points lower entry.", "The effect is larger for pupils on free school meals."] },
    { id: "e2", title: "Can a model predict which grocery orders arrive late?", context: "MSc Data Science project", skills: ["Python", "LightGBM", "SHAP"], findings: ["Recall for late orders rose from 0.62 to 0.79.", "Long runs were late 27% of the time."] },
    { id: "e3", title: "What is Northbridge Retail worth?", context: "Finance coursework, DCF valuation", skills: ["DCF", "Excel modelling", "Sensitivity analysis"], findings: ["Value per share £3.68 against a price of £3.10.", "Upside holds in every case tested."] },
    { id: "e4", title: "Freshers' campaign for the Law Society", context: "Society marketing campaign", skills: ["Social media", "Event planning", "Budgeting"], findings: ["Membership rose from 140 to 236.", "Cost per new member was £3.41."] },
    { id: "e5", title: "What is the Young's modulus of a 6082 aluminium bar?", context: "Year 2 solid mechanics lab", skills: ["Error analysis", "Least squares", "Measurement"], findings: ["E = 66.7 GPa with 2.7 GPa uncertainty.", "The reference value lies inside the range."] },
    { id: "e6", title: "How far did the railway change the town's economy?", context: "History essay, archival sources", skills: ["Archival research", "Source criticism", "Writing"], findings: ["Trade moved to the goods yard.", "The same families kept control of the board."] },
    { id: "e7", title: "When should a revision app send reminders?", context: "Summer internship, A/B test", skills: ["A/B testing", "pandas", "Presenting"], findings: ["Evening reminders gave 3.1 sessions a week against 2.3.", "Completion rose to 46.7%."] },
    { id: "e8", title: "Can a food bank fill its rota a week ahead?", context: "Volunteer project", skills: ["Process design", "Spreadsheets", "Training"], findings: ["Shifts filled a week ahead rose from 64% to 89%.", "Waste fell from 18% to 7%."] },
    { id: "e9", title: "Where do Leeds buses run late?", context: "Personal project, Shiny app", skills: ["R", "Shiny", "Open data"], findings: ["Three routes account for half the late running.", "Lateness peaks between 4pm and 6pm."] },
    { id: "e10", title: "What would a £1 rise in the minimum wage do to hours?", context: "Policy brief", skills: ["Policy writing", "ASHE data", "Excel"], findings: ["Hospitality hours would fall slightly.", "Retail hours would hardly change."] },
  ];
  const moreSkills = ["Data cleaning", "Writing for non-specialists", "Version control"];
  const moreFindings = ["The method is written up so another student could repeat it.", "The limits of the data are stated plainly."];
  return pool.slice(0, n).map((c) =>
    full ? { ...c, skills: [...c.skills, ...moreSkills].slice(0, LIMITS.skills.max), findings: [...c.findings, ...moreFindings].slice(0, LIMITS.findings.max) } : c,
  );
}
const LISTING = `Graduate Policy Analyst, Department for Education (Analysis Directorate)

About the role
You will join a team of twelve analysts who build the evidence behind decisions on further and higher education. You will clean and link administrative data, run regressions and simple evaluations, and turn the results into short briefings for senior officials and ministers.

What you will do
- Link pupil and student records and check them for quality.
- Estimate the effect of policies using regression, difference in differences and other evaluation methods.
- Build clear charts and tables for briefings, and write the words that go with them.
- Answer parliamentary questions and freedom of information requests with accurate figures.
- Work with policy colleagues to frame questions the data can answer.

What we are looking for
- A degree with a strong quantitative element, or equivalent experience.
- Confident use of R, Python or Stata, and of SQL.
- Clear, short writing for readers who are not analysts.
- Care with sensitive personal data.
`;
function heavyListing(): string {
  let s = LISTING;
  const more = [
    "Our directorate also covers apprenticeships, skills bootcamps and adult learning; you may move between teams after a year.",
    "We offer a structured training programme, including the Government Statistical Service induction and a mentor.",
    "Hybrid working: at least 60% of your time in one of our offices in London, Sheffield, Coventry, Darlington or Manchester.",
    "Security clearance at BPSS level is required; you must have lived in the UK for the last three years.",
    "Behaviours assessed: Making Effective Decisions, Communicating and Influencing, Working Together, Delivering at Pace.",
    "Technical skills assessed: Data Analysis, Presenting and Disseminating Data Effectively.",
  ];
  for (let i = 0; s.length < MAX_LISTING_CHARS - 400; i++) s += `\n\nSection ${i + 1}. ${more[i % more.length]} ${LISTING.split("\n")[(i * 3) % 18] ?? ""}`;
  return s.slice(0, MAX_LISTING_CHARS);
}

/**
 * The intro's facts. "sparse" is a person with a name, a target role and two exhbts: the case
 * where the model thinks longest (it was the one cut off at the old 400). "full" is every fact at
 * its longest (the CV to MAX_CV_CHARS, the 8 exhbts the app sends), which the model answers quickly.
 */
function introFacts(full: boolean): IntroFacts {
  const projects = candidates(full ? 8 : 2, false).map((c) => ({ title: c.title, context: c.context, skills: c.skills }));
  return {
    name: "Priya Shah",
    headline: full ? "Economics graduate who checks every number" : "",
    location: full ? "Leeds" : "",
    lookingFor: full ? "A graduate data or policy analyst role, in Leeds or London, from September 2026" : "",
    targetRole: "Graduate data analyst",
    situation: "At university",
    education: full ? heavyRoadmapInput.education : "BSc Economics, University of Leeds",
    skills: full ? heavyRoadmapInput.skills : "R, Excel",
    cv: full ? longCv().slice(0, MAX_CV_CHARS) : "",
    projects,
  };
}

/** n page thumbnails. The 8 distinct pages of the eval PDFs are used in turn: 30 images are the app's maximum, not 30 different pages. */
function pageImages(n: number): PageImage[] {
  const files = readdirSync(PAGES).filter((f) => f.endsWith(".jpg")).sort();
  return Array.from({ length: n }, (_, i) => {
    const f = files[i % files.length]!;
    const data = new Uint8Array(readFileSync(join(PAGES, f)));
    // Each page's size in pixels, read from the file as the route reads it.
    const size = imageSize(data) ?? { width: 0, height: 0 };
    return { label: `report.pdf, page ${i + 1} (${f})`, data, mediaType: "image/jpeg" as const, ...size };
  });
}

const scan = (name: string) => new Uint8Array(readFileSync(join(ROOT, "evals/ai-room/scans", name)));

// ---------------------------------------------------------------------------------------------

type Req = { max_tokens: number } & Record<string, unknown>;
/** How the app reads the answer: a structured call through structuredCall, or a transcription. */
type Read = { kind: "structured"; feature: AIFeature; schema: z.ZodType<unknown>; repair?: (raw: unknown) => unknown } | { kind: "transcript" };
type Case = { feature: string; size: "typical" | "heavy"; request: () => Req; read: Read };

const structured = (feature: AIFeature, schema: z.ZodType<unknown>, repair?: (raw: unknown) => unknown): Read => ({ kind: "structured", feature, schema, repair });

async function cases(): Promise<Case[]> {
  const f01 = await fixtureInput("01-econ-dissertation");
  const heavyText = await heaviestMaterial();
  const heavyDraft: DraftInput = { text: heavyText };
  const tRoad = roadmapFor(typicalJob, false);
  const hRoad = roadmapFor(heavyJob, true);
  const keeping = (r: Roadmap) => [project("Linking pupil and campus data", r.gaps[0]!.skill), project("A briefing on campus distance", r.gaps[1]?.skill ?? r.gaps[0]!.skill)];
  const draft = structured("exhbt_draft", DraftSchema, repairDraft);
  const ideas = structured("project_ideas", IdeasSchema, (raw) => repairIdeas(raw, PLAN_SIZE));
  const swap = structured("project_swap", SwapSchema, repairSwap);
  const out: Case[] = [
    { feature: "draft (control)", size: "typical", request: () => draftRequest(f01), read: draft },
    { feature: "draft (control)", size: "heavy", request: () => draftRequest(heavyDraft), read: draft },
    { feature: "roadmap", size: "typical", request: () => roadmapRequest(typicalRoadmapInput, typicalJob), read: structured("roadmap", RoadmapModelSchema, repairRoadmap) },
    { feature: "roadmap", size: "heavy", request: () => roadmapRequest(heavyRoadmapInput, heavyJob), read: structured("roadmap", RoadmapModelSchema, repairRoadmap) },
    { feature: "project ideas", size: "typical", request: () => ideasRequest({ input: typicalRoadmapInput, roadmap: tRoad, attempt: 1 }), read: ideas },
    { feature: "project ideas", size: "heavy", request: () => ideasRequest({ input: heavyRoadmapInput, roadmap: hRoad, attempt: 1 }), read: ideas },
    { feature: "project swap", size: "typical", request: () => swapRequest({ input: typicalRoadmapInput, roadmap: tRoad, replacing: project("A dashboard", tRoad.gaps[0]!.skill), keeping: keeping(tRoad), note: "", round: 1 }), read: swap },
    { feature: "project swap", size: "heavy", request: () => swapRequest({ input: heavyRoadmapInput, roadmap: hRoad, replacing: project("A dashboard of school data", hRoad.gaps[2]!.skill), keeping: keeping(hRoad), note: "Use real government data, and something I can finish in my final term alongside exams.", round: 3 }), read: swap },
    { feature: "job match", size: "typical", request: () => jobMatchRequest({ company: "Department for Education", roleTitle: "Graduate Policy Analyst", description: LISTING, candidates: candidates(EXHBTS_PER_JOB_LINK, false) }), read: structured("job_match", MatchSchema) },
    { feature: "job match", size: "heavy", request: () => jobMatchRequest({ company: "Department for Education", roleTitle: "Graduate Policy Analyst", description: heavyListing(), candidates: candidates(ENTITLEMENTS.max.exhbts, true) }), read: structured("job_match", MatchSchema) },
    { feature: "portfolio intro", size: "typical", request: () => introRequest(introFacts(false)), read: structured("portfolio_intro", IntroSchema) },
    { feature: "portfolio intro", size: "heavy", request: () => introRequest(introFacts(true)), read: structured("portfolio_intro", IntroSchema) },
    { feature: "figure pick", size: "typical", request: () => figurePickRequest(pageImages(3)), read: structured("figure_pick", AnswerSchema) },
    { feature: "figure pick", size: "heavy", request: () => figurePickRequest(pageImages(FIGURE.maxImages)), read: structured("figure_pick", AnswerSchema) },
    { feature: "file read: cv", size: "typical", request: () => transcribeRequest(scan("cv-typical.jpg"), "image/jpeg", "cv"), read: { kind: "transcript" } },
    { feature: "file read: cv", size: "heavy", request: () => transcribeRequest(scan("cv-long.pdf"), "application/pdf", "cv"), read: { kind: "transcript" } },
    { feature: "file read: project", size: "typical", request: () => transcribeRequest(scan("project-page.jpg"), "image/jpeg", "project"), read: { kind: "transcript" } },
    { feature: "file read: project", size: "heavy", request: () => transcribeRequest(scan("project-12-pages.pdf"), "application/pdf", "project"), read: { kind: "transcript" } },
  ];
  for (const block of DRAFT_BLOCKS) {
    const read = structured("exhbt_rewrite", SCHEMAS[block] as z.ZodType<unknown>);
    out.push({ feature: `rewrite: ${block}`, size: "typical", request: () => rewriteRequest({ block, source: materialText(f01), doc: openBankingDoc, attempt: 1 }), read });
    out.push({ feature: `rewrite: ${block}`, size: "heavy", request: () => rewriteRequest({ block, source: heavyText, doc: fullDoc, note: "Shorter, and lead with the main result.", attempt: 2 }), read });
  }
  return out;
}

/** One run: why it stopped, the tokens, how long it took, and how the app's own reading of the answer went. */
type Run = { stop: string; out: number; inTokens: number; thinking: number | null; ms: number; outcome: string };

const thinkingOf = (r: Anthropic.Message): number | null => {
  const usage = r.usage as unknown as Record<string, unknown>;
  const details = (usage.output_tokens_details ?? usage.output_details) as Record<string, number> | undefined;
  return typeof details?.thinking_tokens === "number" ? details.thinking_tokens : typeof usage.thinking_tokens === "number" ? (usage.thinking_tokens as number) : null;
};

async function runOnce(client: Anthropic, c: Case): Promise<Run> {
  const t0 = Date.now();
  let seen: Anthropic.Message | null = null;
  let outcome = "ok";
  try {
    if (c.read.kind === "structured") {
      // The same reading as the app: stop reason first, then JSON, the repair and the strict schema.
      await structuredCall({ feature: c.read.feature, client, request: c.request() as never, schema: c.read.schema, repair: c.read.repair, onResponse: (r) => (seen = r) });
    } else {
      seen = await client.messages.create(c.request() as unknown as Anthropic.MessageCreateParamsNonStreaming);
      if (readTranscript(seen).truncated) outcome = "truncated (the page says so)";
    }
  } catch (e) {
    outcome = e instanceof AIFailure ? e.reason + (e.status ? ` ${e.status}` : "") : `error: ${(e as Error).message.slice(0, 80)}`;
  }
  const r = seen as Anthropic.Message | null;
  return { stop: r?.stop_reason ?? "none", out: r?.usage.output_tokens ?? 0, inTokens: r?.usage.input_tokens ?? 0, thinking: r ? thinkingOf(r) : null, ms: Date.now() - t0, outcome };
}

async function main() {
  const argv = process.argv.slice(2);
  const runs = Math.max(1, Number(argv[argv.indexOf("--runs") + 1]) || 3);
  const only = argv.includes("--only") ? (argv[argv.indexOf("--only") + 1] ?? "").split(",") : [];
  if (argv.includes("--dry")) {
    for (const c of (await cases()).filter((c) => !only.length || only.some((o) => c.feature.startsWith(o)))) {
      const r = c.request();
      console.log(`${c.feature.padEnd(20)} ${c.size.padEnd(8)} cap ${r.max_tokens}, request ${JSON.stringify(r).length} chars`);
    }
    return;
  }
  const apiKey = anthropicApiKey();
  if (!apiKey) {
    console.error("No API key: set ANTHROPIC_API_KEYS or ANTHROPIC_API_KEY.");
    process.exit(2);
  }
  const client = new Anthropic({ apiKey, maxRetries: 3 });
  const all = (await cases()).filter((c) => !only.length || only.some((o) => c.feature.startsWith(o)));
  const jobs = all.flatMap((c) => Array.from({ length: runs }, () => c));
  const results = new Map<Case, Run[]>();
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const r = await runOnce(client, c);
        results.set(c, [...(results.get(c) ?? []), r]);
      }
    }),
  );

  console.log("| Feature | Input | Cap | Stop reasons | Read as the app reads it | Output tokens (each run) | Thinking tokens | Seconds | Largest / cap |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  let failed = 0;
  for (const c of all) {
    const rs = results.get(c) ?? [];
    const cap = c.request().max_tokens;
    const largest = Math.max(0, ...rs.map((r) => r.out));
    // A transcription cut off is handled (the page says only the first part was read); anything else that isn't ok fails.
    failed += rs.filter((r) => r.outcome !== "ok" && !r.outcome.startsWith("truncated")).length;
    const thinking = rs.some((r) => r.thinking !== null) ? rs.map((r) => r.thinking ?? "?").join(", ") : "not reported";
    const flag = rs.some((r) => r.stop === "max_tokens") ? " CUT OFF" : largest > cap / 3 ? " over a third" : "";
    console.log(
      `| ${c.feature} | ${c.size} | ${cap} | ${rs.map((r) => r.stop).join(", ")} | ${rs.map((r) => r.outcome).join(", ")} | ${rs.map((r) => r.out).join(", ")} | ${thinking} | ${rs.map((r) => (r.ms / 1000).toFixed(1)).join(", ")} | ${((100 * largest) / cap).toFixed(0)}%${flag} |`,
    );
  }
  console.log(failed ? `\n${failed} run(s) failed as the app would read them (see the "Read" column).` : "\nEvery answer was read as the app reads it.");
  const every = [...results.values()].flat();
  const tin = every.reduce((n, r) => n + r.inTokens, 0);
  const tout = every.reduce((n, r) => n + r.out, 0);
  const cost = every.reduce((n, r) => n + costUsd(r.inTokens, r.out), 0);
  console.log(`This run: ${every.length} calls, ${tin} tokens in, ${tout} out, $${cost.toFixed(4)}.`);
  if (failed) process.exit(1);
}

void main();
