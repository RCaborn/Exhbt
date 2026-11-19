import { NextResponse, type NextRequest } from "next/server";
import { emptyDoc } from "@/lib/exhbt/blocks";
import { devBlobs } from "@/lib/files";
import { usernameProblem } from "@/lib/hosts";
import { getStore, isSupabaseConfigured, memorySnapshot, setPlanForDevelopment, setStoredCopiesForDevelopment } from "@/lib/store";

/**
 * Development only: the parity page (decision 0027, "The parity gate"). It stores any doc as a
 * published exhbt exactly as given, so a page can be drawn the same way on every run and on every
 * commit, and compared (e2e/layout-parity.spec.ts). It changes no product code and must run
 * unchanged on main's live commit too: the live pages' "before" is drawn there with it.
 *
 * POST { username, slug, doc, publishedAt?, working? } stores `doc` raw (not read into the current
 * shape) as the published copy and the working copy of an exhbt of the development user of that
 * username (the dev sign-in user for `<username>@example.com`), replacing any exhbt of theirs with that
 * slug, and answers { id, url }. `publishedAt` is its publish date, so the "Checked by exhbt" line is
 * fixed (default 15 January 2026, noon UTC). `working`, when given, is stored as the working copy
 * instead, so a test can have the two copies differ. The new exhbt goes first on the portfolio, so it
 * is always within the plan's limit and reachable.
 *
 * Each image section (or, in a doc saved before sections, each of `images`) gets a flat placeholder
 * picture of its own `w` by `h` (1200 by 800 when it has no size; the doc's `w` and `h` stay as they
 * are), stored as the user's own file with an id made from the slug and the section id, so the same
 * doc gives the same file ids on every run. An image section whose `fileId` is "" is left with no
 * picture, so the page has no address for it (the page leaves such an image out).
 *
 * GET ?id=<id> answers that exhbt's stored working copy and published copy, untouched:
 * { doc, published }.
 *
 * Disabled with Supabase or in production, as app/dev/portfolio is.
 */
const off = () => isSupabaseConfigured() || process.env.NODE_ENV === "production";

const DEFAULT_PUBLISHED_AT = "2026-01-15T12:00:00Z";
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
/** The RFC 4122 URL namespace: any fixed namespace would do. */
const NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export async function POST(req: NextRequest) {
  if (off()) return new NextResponse("Not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (!isObject(body)) return new NextResponse("Send JSON", { status: 400 });
  const username = typeof body.username === "string" ? body.username.toLowerCase() : "";
  const slug = typeof body.slug === "string" ? body.slug : "";
  const publishedAt = typeof body.publishedAt === "string" && !Number.isNaN(Date.parse(body.publishedAt)) ? body.publishedAt : DEFAULT_PUBLISHED_AT;
  if (usernameProblem(username)) return new NextResponse(usernameProblem(username), { status: 400 });
  if (!SLUG.test(slug) || slug.includes("--")) return new NextResponse("Bad slug", { status: 400 });
  if (!isObject(body.doc)) return new NextResponse("doc must be an object", { status: 400 });
  if (body.working !== undefined && !isObject(body.working)) return new NextResponse("working must be an object", { status: 400 });

  const store = getStore();
  const userId = `dev-${username}@example.com`;
  if ((await store.claimUsername(userId, username)) === "taken") return new NextResponse("Username taken", { status: 409 });
  // A plan with a public portfolio and room for many exhbts, and the same person every time (their name is on the page).
  setPlanForDevelopment(userId, "max");
  await store.updatePortfolioProfile(userId, {
    name: "Amara Okafor",
    headline: "Data analyst, health and public services",
    bio: "Final-year Data Science student. I like problems where a small change saves real time or money.",
    themeId: null,
    photoFileId: null,
    hideFromSearch: false,
  });
  for (const e of await store.listExhbts(userId)) if (e.slug === slug) await store.deleteExhbt(e.id, userId);

  const files = new Map<string, { w: number; h: number }>();
  const doc = await withPlaceholders(body.doc, slug, files);
  const working = body.working === undefined ? doc : await withPlaceholders(body.working, slug, files);
  for (const [fileId, size] of files) await placeholderPicture(userId, fileId, size.w, size.h);

  // Made from an empty doc (the store reads a doc into the current shape), then both copies set exactly as given.
  const id = await store.createExhbt(userId, emptyDoc());
  await store.publishExhbt(id, userId, slug);
  setStoredCopiesForDevelopment(id, { doc: working, published: doc });
  const record = memorySnapshot()?.exhbts.get(id);
  if (record) Object.assign(record, { publishedAt, confirmedAt: publishedAt });
  const ids = (await store.listExhbts(userId)).map((e) => e.id);
  await store.reorderExhbts(userId, [id, ...ids.filter((x) => x !== id)]);
  return NextResponse.json({ id, url: `/p/${username}/${slug}` });
}

export async function GET(req: NextRequest) {
  if (off()) return new NextResponse("Not found", { status: 404 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const e = memorySnapshot()?.exhbts.get(id);
  if (!e) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ doc: e.doc, published: e.published });
}

/** The doc with each image pointed at its placeholder picture; `files` collects the pictures to store. */
async function withPlaceholders(raw: Obj, slug: string, files: Map<string, { w: number; h: number }>): Promise<Obj> {
  const doc = structuredClone(raw);
  const list = Array.isArray(doc.sections) ? doc.sections : Array.isArray(doc.images) ? doc.images : [];
  const old = !Array.isArray(doc.sections);
  let n = 0;
  for (const s of list) {
    if (!isObject(s) || (!old && s.kind !== "image")) continue;
    n++;
    if (s.fileId === "") continue;
    // A doc saved before sections: its images are read as image-1, image-2 (normaliseDoc).
    const sectionId = !old && typeof s.id === "string" && s.id ? s.id : `image-${n}`;
    const fileId = await nameUuid(`${slug}/${sectionId}`);
    s.fileId = fileId;
    const sized = typeof s.w === "number" && typeof s.h === "number" && s.w > 0 && s.h > 0;
    files.set(fileId, sized ? { w: Math.round(s.w as number), h: Math.round(s.h as number) } : { w: 1200, h: 800 });
  }
  return doc;
}

/** A name-based UUID (version 5, SHA-1), so the same name gives the same file id on every run. */
async function nameUuid(name: string): Promise<string> {
  const ns = Uint8Array.from(NAMESPACE.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16)));
  const bytes = new Uint8Array([...ns, ...new TextEncoder().encode(name)]);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A flat picture of one grey, `w` by `h`, stored as the user's own file in the in-memory Storage stand-in. */
async function placeholderPicture(userId: string, id: string, w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#c3c6cd"/></svg>`;
  const bytes = new TextEncoder().encode(svg);
  await getStore().createFile({ id, userId, bucket: "evidence", path: `${userId}/${id}/image.svg`, mime: "image/svg+xml", bytes: bytes.length, kind: "image" });
  devBlobs().set(id, bytes);
}
