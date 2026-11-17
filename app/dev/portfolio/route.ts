import { NextResponse, type NextRequest } from "next/server";
import type { Plan } from "@/lib/entitlements";
import { normaliseDoc, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { fullDoc, openBankingDoc, sampleDocs, sampleSeeds } from "@/lib/exhbt/sample";
import { devBlobs } from "@/lib/files";
import { usernameProblem } from "@/lib/hosts";
import { normaliseLayout } from "@/lib/portfolio-layout";
import { getStore, isSupabaseConfigured, setPlanForDevelopment, setStoredCopiesForDevelopment } from "@/lib/store";

const PLANS: Plan[] = ["free", "premium", "max", "institutional"];

/** Titles for copies of a sample exhbt, so `count` can go past the samples (to try the customiser with several tiles). */
const MORE_TITLES = [
  "Planning staff rotas for a campus cafe",
  "Mapping late buses on a student route",
  "Tracking recycling across a halls site",
  "Costing a society's events budget",
  "Measuring noise around a library",
  "Comparing study spaces by how often they are used",
];
const MAX_COUNT = sampleSeeds.length + MORE_TITLES.length;

/**
 * Development only: makes a fictional portfolio so the pages can be seen and tested before the
 * editor exists. /dev/portfolio?username=amara&plan=premium&count=2 → /p/amara.
 * The user is the dev sign-in user for `<username>@example.com` (app/auth/dev), so signing in
 * as that address later edits the same portfolio. Disabled with Supabase or in production.
 *
 * The GP sample is stored in the layout from before sections (lib/exhbt/sample.ts, decision
 * 0015), in both copies, so the path old exhbts take is what the pages show. `layout=sections`
 * stores it already read into sections instead, to compare the two. `with=open-banking` adds the
 * sample in the page layout of decision 0022 at /p/<username>/open-banking; `with=full` the same with
 * every section but an image, near the word cap, at /p/<username>/open-banking-full.
 */
export async function GET(req: NextRequest) {
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const username = (q.get("username") ?? "amara").toLowerCase();
  const planParam = q.get("plan") ?? "premium";
  const plan = planParam as Plan;
  const count = Math.max(0, Math.min(MAX_COUNT, Number(q.get("count") ?? sampleSeeds.length)));
  const converted = q.get("layout") === "sections";
  if (usernameProblem(username)) return new NextResponse(usernameProblem(username), { status: 400 });
  if (planParam !== "subscription" && !PLANS.includes(plan)) return new NextResponse("Unknown plan", { status: 400 });

  const store = getStore();
  const userId = `dev-${username}@example.com`;
  if ((await store.claimUsername(userId, username)) === "taken") return new NextResponse("Username taken", { status: 409 });
  if (planParam !== "subscription") setPlanForDevelopment(userId, plan);
  // `look=<id>` saves a portfolio look (decision 0018); `name=` a different name (try a long one);
  // `rich=1` fills in everything a person can give (where, what they want, links, about, education,
  // experience, a quote), so every part of every look shows.
  const rich = q.get("rich") === "1";
  await store.updatePortfolioProfile(userId, {
    name: q.get("name")?.slice(0, 80) || "Amara Okafor",
    headline: "Data analyst, health and public services",
    bio: "Final-year Data Science student. I like problems where a small change saves real time or money.",
    linkedin: "https://www.linkedin.com/in/example",
    themeId: q.get("look") || null,
    ...(rich
      ? { location: "Leeds", lookingFor: "Graduate data roles in the NHS or local government", github: "https://github.com/example", contactEmail: "amara@example.com" }
      : {}),
    // hide=1: "hide my portfolio from search engines" is on (the SEO checks).
    hideFromSearch: q.get("hide") === "1",
    photoFileId: q.get("photo") === "1" ? await placeholderPhoto(userId) : null,
  });
  for (const e of await store.listExhbts(userId)) await store.deleteExhbt(e.id, userId);
  // A fresh arrangement too: the default layout, nothing hidden or featured.
  const layout = normaliseLayout(
    rich
      ? {
          v: 1,
          slots: ["featured", "work", "about", "experience", "quote", "contact"],
          tiles: {
            about: { text: "I grew up helping in my family's pharmacy, which is where I first saw how much a missed appointment costs. I like work where the numbers lead to a change someone can feel." },
            education: { lines: ["BSc Data Science, University of Leeds 2026", "A levels: Maths, Biology, Economics 2023"], tools: "Python, SQL, Power BI" },
            experience: { lines: ["Data intern, Leeds Teaching Hospitals 2025", "Weekend pharmacy assistant 2021–2024"] },
            quote: { text: "Amara's reminder trial changed how our practice books follow-ups.", name: "Dr Sam Patel", role: "GP partner" },
          },
        }
      : null,
  );
  await store.savePortfolioLayout(userId, { layout, featuredExhbtId: null, hiddenIds: [], order: [] });
  // `graphs=none` drops the graphs from the samples, for a portfolio whose key figures are all flowcharts.
  const noGraphs = q.get("graphs") === "none";
  for (let i = 0; i < count; i++) {
    const seed = i < sampleSeeds.length ? sampleSeeds[i] : undefined;
    const base = sampleDocs[i % sampleDocs.length]!;
    let doc = seed !== undefined ? normaliseDoc(seed) : { ...base, title: MORE_TITLES[i - sampleSeeds.length]! };
    if (noGraphs) doc = { ...doc, sections: doc.sections.filter((s) => s.kind !== "graph") };
    const id = await store.createExhbt(userId, doc);
    await store.publishExhbt(id, userId, i === 0 ? "gp-reminders" : i === 1 ? "library-footfall" : `project-${i + 1}`);
    // As stored before sections, both copies (createExhbt and publishing write the current shape).
    if (seed !== undefined && !converted && !noGraphs && (seed as ExhbtDoc).sections === undefined) {
      setStoredCopiesForDevelopment(id, { doc: seed, published: seed });
    }
  }
  // The exhbt in the page layout of decision 0022 (title as the question, summary, where and when), last.
  if (q.get("with") === "open-banking") {
    const id = await store.createExhbt(userId, noGraphs ? { ...openBankingDoc, sections: openBankingDoc.sections.filter((s) => s.kind !== "graph") } : openBankingDoc);
    await store.publishExhbt(id, userId, "open-banking");
  }
  // The same with every section but an image, near the word cap (the one-page print check).
  if (q.get("with") === "full") {
    const id = await store.createExhbt(userId, fullDoc);
    await store.publishExhbt(id, userId, "open-banking-full");
  }
  return NextResponse.redirect(new URL(`/p/${username}`, req.url));
}

/**
 * `photo=1`: a stand-in profile photo (a flat head-and-shoulders drawing, not a person), kept in the
 * in-memory Storage stand-in, so every look can be seen with a photo as well as with initials.
 */
async function placeholderPhoto(userId: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#c8bba9"/><circle cx="200" cy="160" r="78" fill="#6b4f3d"/><path d="M60 400c0-90 62-150 140-150s140 60 140 150z" fill="#34465a"/></svg>`;
  const bytes = new TextEncoder().encode(svg);
  const id = crypto.randomUUID();
  await getStore().createFile({ id, userId, bucket: "evidence", path: `${userId}/${id}/photo.svg`, mime: "image/svg+xml", bytes: bytes.length, kind: "photo" });
  devBlobs().set(id, bytes);
  return id;
}
