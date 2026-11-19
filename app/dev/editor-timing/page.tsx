import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PageEditorProps } from "@/components/exhbt-editor/context";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { BEFORE_AFTER_IMAGES, beforeAfterDoc, BUILD_IMAGES, buildDoc, essayDoc, EVENT_IMAGES, eventDoc, fullDoc, GALLERY_IMAGES, galleryDoc, researchDoc } from "@/lib/exhbt/sample";
import { DEFAULT_THEME, themeById } from "@/lib/portfolio-themes";
import { full } from "../edit-slots/stand-in";
import { TimingEditor } from "./TimingEditor";

export const metadata: Metadata = { title: "Editor timing", robots: { index: false, follow: false } };
// The gate is read on each request, so one build serves the preview Worker (EXHBT_LAB=1) and the live one (never set).
export const dynamic = "force-dynamic";

/*
 * The editor's timing harness (decision 0026, "Smoothness"; F's scripts/editor-timing.mjs opens it on a
 * production build with the processor slowed): the edit-on-page editor drawn on a sample, with no
 * sign-in, nothing stored and a save that does nothing. Pictures are flat grey drawings of each image's
 * size, as data addresses.
 *
 *   ?sample=   gallery (the default: the longest), case-study, research, build, essay, before-after, event
 *   ?look=     a portfolio look's id (the Exhbt look by default)
 *   ?full=1    every empty optional part given words first (the slot harness's full(), app/dev/edit-slots), for the box-for-box tests
 *
 * Not found unless NODE_ENV is not production, or the build has EXHBT_LAB=1 (as the lab's page was
 * gated; it is never set on the live Worker).
 */

const enabled = () => process.env.NODE_ENV !== "production" || process.env.EXHBT_LAB === "1";

const ids = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}-${i + 1}`);
const SAMPLES: Record<string, () => ExhbtDoc> = {
  gallery: () => galleryDoc(ids(GALLERY_IMAGES.length, "gallery")),
  "case-study": () => fullDoc,
  research: () => researchDoc("research-1"),
  build: () => buildDoc(ids(BUILD_IMAGES.length, "build")),
  essay: () => essayDoc("essay-1"),
  "before-after": () => beforeAfterDoc(ids(BEFORE_AFTER_IMAGES.length, "before-after")),
  event: () => eventDoc(ids(EVENT_IMAGES.length, "event")),
};

/** A flat grey picture of the image's own size, as a data address, so nothing is stored. */
function picture(w = 1200, h = 800): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#c3c6cd"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default async function EditorTiming({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!enabled()) notFound();
  const q = await searchParams;
  const name = typeof q.sample === "string" && q.sample in SAMPLES ? q.sample : "gallery";
  const sample = SAMPLES[name]!();
  const doc = q.full === "1" ? full(sample) : sample;
  const theme = (typeof q.look === "string" && themeById(q.look)) || DEFAULT_THEME;
  const imageUrls = Object.fromEntries(doc.sections.flatMap((s) => (s.kind === "image" && s.fileId ? [[s.fileId, picture(s.w, s.h)]] : [])));
  const props: PageEditorProps = {
    id: `timing-${name}`,
    initialDoc: doc,
    status: "draft",
    slug: null,
    liveBase: null,
    owner: { name: "Amara Okafor", photoUrl: null, bio: "Final-year Data Science student." },
    imageUrls,
    fileEvidenceUrl: null,
    planBlock: null,
    updatedAt: new Date().toISOString(),
    canGoLive: false,
    maxFileMb: 10,
    liveFileIds: [],
    figureSources: {},
    draftTools: null,
    theme,
    reportFiles: [],
  };
  return (
    <div data-editor-timing={name}>
      <TimingEditor {...props} />
    </div>
  );
}
