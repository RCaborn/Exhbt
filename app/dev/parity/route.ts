import { NextResponse, type NextRequest } from "next/server";
import { loadAiVersion, saveAiVersion } from "@/lib/draft-tools";
import type { Plan } from "@/lib/entitlements";
import { emptyDoc } from "@/lib/exhbt/blocks";
import type { AiVersion } from "@/lib/exhbt/draft-blocks";
import { devBlobs } from "@/lib/files";
import { usernameProblem } from "@/lib/hosts";
import { getStore, isSupabaseConfigured, memorySnapshot, setPlanForDevelopment, setStoredCopiesForDevelopment } from "@/lib/store";

/**
 * Development only: the parity page (decision 0027, "The parity gate"). It stores any doc as an
 * exhbt exactly as given, so a page can be drawn the same way on every run and on every commit, and
 * compared (e2e/layout-parity.spec.ts); the editor tests seed docs with it too. It changes no
 * product code and must run unchanged on main's live commit: the live pages' "before" is drawn there.
 *
 * POST { username, slug, doc, working?, publishedAt?, plan?, extraFiles?, aiVersion? } stores a published exhbt
 * for the development user of that username (the dev sign-in user for `<username>@example.com`),
 * raw, not read into the current shape: `doc` is its published copy and `working` its working copy
 * (`doc` when absent). Any exhbt of theirs with that slug is replaced, and the new one goes first on
 * their portfolio, so it is always within the plan's cap and reachable. `publishedAt` is its publish
 * date, so the "Checked by exhbt" line is fixed (default 15 January 2026, noon UTC). `plan` is the
 * user's plan, as /dev/portfolio sets it (default `max`). It answers { id, url, files }.
 *
 * Each image section in either copy (or, in a doc saved before sections, each of `images`) gets a
 * flat placeholder picture of its own `w` by `h` (1200 by 800 when it has no size; the doc's `w` and
 * `h` stay as they are), stored as the user's own file with an id made from the slug and the section
 * id, so the same doc gives the same file ids on every run. An image section whose `fileId` is "" is
 * left with no picture, so the page has no address for it (the page leaves such an image out).
 * `extraFiles` is a list of names: for each, one more placeholder picture of the user's that neither
 * copy points at, its id made from the slug and the name. `files` maps each image section's id and
 * each extra name to its file id.
 *
 * `aiVersion`, when given, is saved as the exhbt's AI version (saveAiVersion, as a draft saves it),
 * so a test can seed one with graphs.
 *
 * GET ?id=<id> answers that exhbt's stored copies, untouched, and its AI version as loadAiVersion
 * reads it: { working, published, aiVersion }.
 *
 * Disabled with Supabase or in production, as app/dev/portfolio is.
 */
const off = () => isSupabaseConfigured() || process.env.NODE_ENV === "production";

const DEFAULT_PUBLISHED_AT = "2026-01-15T12:00:00Z";
const PLANS: Plan[] = ["free", "premium", "max", "institutional"];
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
/** The RFC 4122 URL namespace: any fixed namespace would do. */
const NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
type Pictures = { sizes: Map<string, { w: number; h: number }>; ids: Record<string, string> };

export async function POST(req: NextRequest) {
  if (off()) return new NextResponse("Not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as Obj | null;
  if (!isObject(body)) return new NextResponse("Send JSON", { status: 400 });
  const username = typeof body.username === "string" ? body.username.toLowerCase() : "";
  const slug = typeof body.slug === "string" ? body.slug : "";
  const publishedAt = typeof body.publishedAt === "string" && !Number.isNaN(Date.parse(body.publishedAt)) ? body.publishedAt : DEFAULT_PUBLISHED_AT;
  const plan = (body.plan ?? "max") as Plan;
  const extra = body.extraFiles ?? [];
  if (usernameProblem(username)) return new NextResponse(usernameProblem(username), { status: 400 });
  if (!SLUG.test(slug) || slug.includes("--")) return new NextResponse("Bad slug", { status: 400 });
  if (!isObject(body.doc)) return new NextResponse("doc must be an object", { status: 400 });
  if (body.working !== undefined && !isObject(body.working)) return new NextResponse("working must be an object", { status: 400 });
  if (!PLANS.includes(plan)) return new NextResponse("Unknown plan", { status: 400 });
  if (!Array.isArray(extra) || !extra.every((n) => typeof n === "string" && n)) return new NextResponse("extraFiles must be a list of names", { status: 400 });
  if (body.aiVersion !== undefined && !isObject(body.aiVersion)) return new NextResponse("aiVersion must be an object", { status: 400 });

  const store = getStore();
  const userId = `dev-${username}@example.com`;
  if ((await store.claimUsername(userId, username)) === "taken") return new NextResponse("Username taken", { status: 409 });
  setPlanForDevelopment(userId, plan);
  // The same person every time: their name is on the page.
  await store.updatePortfolioProfile(userId, {
    name: "Amara Okafor",
    headline: "Data analyst, health and public services",
    bio: "Final-year Data Science student. I like problems where a small change saves real time or money.",
    themeId: null,
    photoFileId: null,
    hideFromSearch: false,
  });
  for (const e of await store.listExhbts(userId)) if (e.slug === slug) await store.deleteExhbt(e.id, userId);

  const pictures: Pictures = { sizes: new Map(), ids: {} };
  const doc = await withPlaceholders(body.doc, slug, pictures);
  const working = body.working === undefined ? doc : await withPlaceholders(body.working, slug, pictures);
  for (const name of extra as string[]) {
    const fileId = await nameUuid(`${slug}/${name}`);
    pictures.ids[name] = fileId;
    pictures.sizes.set(fileId, { w: 1200, h: 800 });
  }
  for (const [fileId, size] of pictures.sizes) await placeholderPicture(userId, fileId, size.w, size.h);

  // Made from an empty doc (the store reads a doc into the current shape), then both copies set exactly as given.
  const id = await store.createExhbt(userId, emptyDoc());
  await store.publishExhbt(id, userId, slug, { unchecked: true });
  setStoredCopiesForDevelopment(id, { doc: working, published: doc });
  // The store has no method for the publish date: set on the stored record.
  const record = memorySnapshot()?.exhbts.get(id);
  if (record) Object.assign(record, { publishedAt, confirmedAt: publishedAt });
  const ids = (await store.listExhbts(userId)).map((e) => e.id);
  await store.reorderExhbts(userId, [id, ...ids.filter((x) => x !== id)]);
  if (body.aiVersion !== undefined) await saveAiVersion(userId, id, body.aiVersion as AiVersion);
  return NextResponse.json({ id, url: `/p/${username}/${slug}`, files: pictures.ids });
}

export async function GET(req: NextRequest) {
  if (off()) return new NextResponse("Not found", { status: 404 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const e = memorySnapshot()?.exhbts.get(id);
  if (!e) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ working: e.doc, published: e.published, aiVersion: await loadAiVersion(e.userId, id) });
}

/** The doc with each image pointed at its placeholder picture; `pictures` collects the pictures to store and their ids. */
async function withPlaceholders(raw: Obj, slug: string, pictures: Pictures): Promise<Obj> {
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
    const fileId = await nameUuid(`${slug}/${sectionId}`);
    s.fileId = fileId;
    pictures.ids[sectionId] = fileId;
    const sized = typeof s.w === "number" && typeof s.h === "number" && s.w > 0 && s.h > 0;
    pictures.sizes.set(fileId, sized ? { w: Math.round(s.w as number), h: Math.round(s.h as number) } : { w: 1200, h: 800 });
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
