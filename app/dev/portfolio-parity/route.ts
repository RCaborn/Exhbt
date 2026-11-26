import { NextResponse, type NextRequest } from "next/server";
import type { Plan } from "@/lib/entitlements";
import { emptyDoc } from "@/lib/exhbt/blocks";
import { devBlobs } from "@/lib/files";
import { usernameProblem } from "@/lib/hosts";
import { normaliseLayout } from "@/lib/portfolio-layout";
import { getStore, isSupabaseConfigured, memorySnapshot, setPlanForDevelopment, setStoredCopiesForDevelopment, type PortfolioProfile } from "@/lib/store";

/**
 * Development only: the portfolio parity page (brief A of docs/briefs/portfolio-first, decision 0031,
 * "Visitors' pages stay as they are"). It stores one whole portfolio exactly as given, so its pages are
 * drawn the same way on every run, on every day and on every commit, and compared with golden copies
 * (e2e/portfolio-parity.spec.ts). The portfolio editor's tests seed their pages with it too. It changes
 * no product code and must run unchanged on main's commit, where the golden copies were drawn.
 *
 * POST, with the fixture as JSON (its type is `PortfolioFixture` in e2e/fixtures/portfolio-pages.ts):
 *   username   the portfolio's address; the person is the dev sign-in user for `<username>@example.com`
 *   plan       "free", "premium", "max" or "institutional" (default "max"), set as /dev/plan sets it
 *   look       the stored look (`profiles.portfolio_theme`), any id, kept even if the plan lacks it; null is the default
 *   person     { name, headline?, bio?, location?, lookingFor?, linkedin?, github?, website?, contactEmail?,
 *              hideFromSearch?, photo? }: the profile's fields by their Store names; `photo: true` gives a photo
 *   layout     `profiles.portfolio_layout` as stored (any shape: 0014's "p" markers too), read through
 *              normaliseLayout as the Supabase store reads a stored row
 *   exhbts     [{ key, slug, doc, working?, draft?, hidden? }] in portfolio order. `doc` is the published copy and
 *              `working` the working copy (`doc` when absent), both stored raw, as /dev/parity stores them. A draft
 *              is never published: `doc` is its working copy. `hidden` leaves it off the glance page.
 *   featured   the key of the starred exhbt, or null
 *   jobLinks   [{ slug, company, roleTitle, intro?, picks: [{ exhbt: key, reason }] }], live
 *   publishedAt  every exhbt's publish date (default 15 January 2026, noon UTC), so no date on a page moves
 *
 * Every id is fixed: an exhbt's id, the photo's file id and each picture's file id are name-based UUIDs
 * made from the username and the exhbt's key (and the section's id), so the same fixture gives the same
 * page, markup included, on every run. Each image section gets a flat placeholder picture of its own `w`
 * by `h` (1200 by 800 when it has none), stored as the person's own file; one whose `fileId` is "" gets
 * none, so the page has no address for it. The photo is a flat head-and-shoulders drawing, not a person.
 *
 * Everything the person had before is replaced: every profile field is written (null when the fixture
 * leaves it out), and their exhbts and job links are deleted first, so a second seed (a retry) gives
 * the same page as the first. It answers { userId, username, url, ids, files }: `ids` maps each exhbt's
 * key to its id, `files` maps "photo" and each `<key>/<section id>` to a file id.
 *
 * The Store has no way to choose an exhbt's id or its publish date, so those two are set on the stored
 * record, as /dev/parity sets the date. Disabled with Supabase or in production, as app/dev/portfolio is.
 */
const off = () => isSupabaseConfigured() || process.env.NODE_ENV === "production";

const DEFAULT_PUBLISHED_AT = "2026-01-15T12:00:00Z";
const PLANS: Plan[] = ["free", "premium", "max", "institutional"];
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** The RFC 4122 URL namespace: any fixed namespace would do. */
const NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

type ExhbtIn = { key: string; slug: string; doc: Obj; working?: Obj; draft: boolean; hidden: boolean };
type JobLinkIn = { slug: string; company: string; roleTitle: string; intro: string; picks: { exhbt: string; reason: string }[] };

const bad = (why: string) => new NextResponse(why, { status: 400 });

export async function POST(req: NextRequest) {
  if (off()) return new NextResponse("Not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (!isObject(body)) return bad("Send JSON");
  const username = typeof body.username === "string" ? body.username.toLowerCase() : "";
  if (usernameProblem(username)) return bad(usernameProblem(username)!);
  const plan = (body.plan ?? "max") as Plan;
  if (!PLANS.includes(plan)) return bad("Unknown plan");
  if (body.look !== undefined && body.look !== null && typeof body.look !== "string") return bad("look must be a string or null");
  if (!isObject(body.person) || !str(body.person.name)) return bad("person must have a name");
  const person = body.person;
  const publishedAt = typeof body.publishedAt === "string" && !Number.isNaN(Date.parse(body.publishedAt)) ? body.publishedAt : DEFAULT_PUBLISHED_AT;

  const exhbts: ExhbtIn[] = [];
  for (const e of Array.isArray(body.exhbts) ? body.exhbts : body.exhbts === undefined ? [] : [null]) {
    if (!isObject(e) || typeof e.key !== "string" || !KEY.test(e.key)) return bad("Each exhbt needs a key of lower-case letters, numbers and hyphens");
    if (typeof e.slug !== "string" || !SLUG.test(e.slug) || e.slug.includes("--")) return bad(`Bad slug for ${e.key}`);
    if (!isObject(e.doc)) return bad(`doc must be an object (${e.key})`);
    if (e.working !== undefined && !isObject(e.working)) return bad(`working must be an object (${e.key})`);
    if (exhbts.some((x) => x.key === e.key || x.slug === e.slug)) return bad(`${e.key}: a key or slug used twice`);
    exhbts.push({ key: e.key, slug: e.slug, doc: e.doc, working: e.working as Obj | undefined, draft: e.draft === true, hidden: e.hidden === true });
  }
  const featured = body.featured ?? null;
  if (featured !== null && !exhbts.some((e) => e.key === featured)) return bad("featured must be the key of one of the exhbts, or null");

  const jobLinks: JobLinkIn[] = [];
  for (const l of Array.isArray(body.jobLinks) ? body.jobLinks : body.jobLinks === undefined ? [] : [null]) {
    if (!isObject(l) || typeof l.slug !== "string" || !SLUG.test(l.slug) || l.slug.includes("--")) return bad("Each job link needs a slug");
    if (exhbts.some((e) => e.slug === l.slug) || jobLinks.some((x) => x.slug === l.slug)) return bad(`${l.slug}: a slug used twice`);
    if (!str(l.company) || typeof l.roleTitle !== "string") return bad(`${l.slug}: a company and a role title`);
    const picks = Array.isArray(l.picks) ? l.picks : [];
    if (!picks.every((p) => isObject(p) && exhbts.some((e) => e.key === p.exhbt) && typeof p.reason === "string")) return bad(`${l.slug}: each pick is { exhbt: a key, reason }`);
    jobLinks.push({ slug: l.slug, company: l.company as string, roleTitle: l.roleTitle, intro: typeof l.intro === "string" ? l.intro : "", picks: picks as JobLinkIn["picks"] });
  }

  const store = getStore();
  const userId = `dev-${username}@example.com`;
  if ((await store.claimUsername(userId, username)) === "taken") return new NextResponse("Username taken", { status: 409 });
  setPlanForDevelopment(userId, plan);
  for (const e of await store.listExhbts(userId)) await store.deleteExhbt(e.id, userId);
  for (const l of await store.listJobLinks(userId)) await store.deleteJobLink(l.id, userId);

  const files: Record<string, string> = {};
  if (person.photo === true) {
    files.photo = await nameUuid(`${username}/photo`);
    await storeSvg(userId, files.photo, "photo", PHOTO);
  }
  const text = (k: string) => str(person[k]);
  const fields: Pick<PortfolioProfile, "name" | "headline" | "bio" | "photoFileId" | "linkedin" | "github" | "website" | "contactEmail" | "location" | "lookingFor" | "hideFromSearch" | "themeId"> = {
    name: text("name"),
    headline: text("headline"),
    bio: text("bio"),
    photoFileId: files.photo ?? null,
    linkedin: text("linkedin"),
    github: text("github"),
    website: text("website"),
    contactEmail: text("contactEmail"),
    location: text("location"),
    lookingFor: text("lookingFor"),
    hideFromSearch: person.hideFromSearch === true,
    themeId: typeof body.look === "string" && body.look ? body.look : null,
  };
  await store.updatePortfolioProfile(userId, fields);

  const mem = memorySnapshot();
  if (!mem) return new NextResponse("The in-memory store has not started", { status: 500 });
  const ids: Record<string, string> = {};
  for (const e of exhbts) {
    const id = await nameUuid(`${username}/exhbt/${e.key}`);
    if (mem.exhbts.has(id)) return new NextResponse(`${e.key}: its id is someone else's`, { status: 409 });
    // Pictures first: each is the person's own stored file before any copy points at it.
    const published = await withPlaceholders(e.doc, username, e.key, userId, files);
    const working = e.working === undefined ? published : await withPlaceholders(e.working, username, e.key, userId, files);
    // Made from an empty doc (the store reads a doc into the current shape), given its fixed id, then both copies set exactly as given.
    const madeAs = await store.createExhbt(userId, emptyDoc());
    const record = mem.exhbts.get(madeAs)!;
    mem.exhbts.delete(madeAs);
    record.id = id;
    mem.exhbts.set(id, record);
    if (!e.draft) await store.publishExhbt(id, userId, e.slug, { unchecked: true });
    setStoredCopiesForDevelopment(id, { doc: e.draft ? published : working, published: e.draft ? null : published });
    Object.assign(record, e.draft ? { updatedAt: publishedAt } : { publishedAt, confirmedAt: publishedAt, updatedAt: publishedAt });
    ids[e.key] = id;
  }

  const order = exhbts.map((e) => ids[e.key]!);
  await store.savePortfolioLayout(userId, {
    layout: normaliseLayout(body.layout ?? null),
    featuredExhbtId: featured === null ? null : ids[featured as string]!,
    hiddenIds: exhbts.filter((e) => e.hidden).map((e) => ids[e.key]!),
    order,
  });

  for (const l of jobLinks) {
    await store.createJobLink({
      userId,
      company: l.company,
      roleTitle: l.roleTitle,
      slug: l.slug,
      slugStyle: "clean",
      intro: l.intro,
      picks: l.picks.map((p) => ({ exhbtId: ids[p.exhbt]!, reason: p.reason })),
      listingText: null,
      listingUrl: null,
    });
  }

  return NextResponse.json({ userId, username, url: `/p/${username}`, ids, files });
}

/** The doc with each image pointed at its placeholder picture, each stored as the person's own file; `files` collects the ids. */
async function withPlaceholders(raw: Obj, username: string, key: string, userId: string, files: Record<string, string>): Promise<Obj> {
  const doc = structuredClone(raw);
  const old = !Array.isArray(doc.sections);
  const list = !old ? (doc.sections as unknown[]) : Array.isArray(doc.images) ? doc.images : [];
  let n = 0;
  for (const s of list) {
    if (!isObject(s) || (!old && s.kind !== "image")) continue;
    n++;
    if (s.fileId === "") continue;
    // A doc saved before sections: its images are read as image-1, image-2 (normaliseDoc).
    const sectionId = !old && typeof s.id === "string" && s.id ? s.id : `image-${n}`;
    const fileId = await nameUuid(`${username}/${key}/${sectionId}`);
    s.fileId = fileId;
    files[`${key}/${sectionId}`] = fileId;
    const sized = typeof s.w === "number" && typeof s.h === "number" && s.w > 0 && s.h > 0;
    const w = sized ? Math.round(s.w as number) : 1200;
    const h = sized ? Math.round(s.h as number) : 800;
    await storeSvg(userId, fileId, "image", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#c3c6cd"/></svg>`);
  }
  return doc;
}

/** A flat head-and-shoulders drawing (not a person), square, as /dev/portfolio's stand-in photo. */
const PHOTO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><rect width="400" height="400" fill="#c8bba9"/><circle cx="200" cy="160" r="78" fill="#6b4f3d"/><path d="M60 400c0-90 62-150 140-150s140 60 140 150z" fill="#34465a"/></svg>`;

/** An SVG stored as one of the person's files in the in-memory Storage stand-in, under a fixed id. */
async function storeSvg(userId: string, id: string, kind: "photo" | "image", svg: string) {
  const bytes = new TextEncoder().encode(svg);
  await getStore().createFile({ id, userId, bucket: "evidence", path: `${userId}/${id}/${kind}.svg`, mime: "image/svg+xml", bytes: bytes.length, kind });
  devBlobs().set(id, bytes);
}

/** A name-based UUID (version 5, SHA-1), so the same name gives the same id on every run. */
async function nameUuid(name: string): Promise<string> {
  const ns = Uint8Array.from(NAMESPACE.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16)));
  const bytes = new Uint8Array([...ns, ...new TextEncoder().encode(name)]);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
