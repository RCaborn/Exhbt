import { RichText } from "@/components/exhbt/RichText";
import { ItemView } from "@/components/portfolio/LayoutMain";
import type { EditAdapter, PageCtx } from "@/components/portfolio/page-ctx";
import { Button } from "@/components/ui/Button";
import { emptyDoc, text, type ExhbtDoc, type Section } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, formatOf } from "@/lib/exhbt/formats";
import { pageItems } from "@/lib/exhbt/layouts";
import { fullDoc, GALLERY_IMAGES, galleryDoc, libraryDoc, openBankingDoc, researchDoc } from "@/lib/exhbt/sample";

/*
 * The slot harness's own parts (app/dev/edit-slots, development only): the samples it draws, the
 * filling `?full=1` gives them, and a stand-in for the editor's adapter. The stand-in marks each slot
 * and adds no box of its own, so e2e/edit-slots.spec.ts can find every slot and compare the page's
 * boxes with and without it. Nothing here is the editor: it never types, saves or moves anything.
 *
 * What it draws, slot by slot:
 *  - text and rich: the words in a <span data-slot data-path data-label> with `display: contents`
 *    (rich in a <div> with the paragraph's classes when it is given them); an empty field shows its
 *    placeholder in --xp-muted and carries data-empty;
 *  - item: <div data-slot="item" data-id data-as> with the row's classes, round ItemView;
 *  - insert, list, tools, the flowchart's tools and "+", and an "above" or "over" extra: marked,
 *    empty elements that take no room (`hidden`); the flowchart's list returns its <ol> inside a
 *    marked `display: contents` element, and its box the <li> it is given;
 *  - the two edit-only fields decision 0026 keeps in the flow, drawn as the editor will, marked
 *    and inert: the skills end with an "Add a skill" box the size of a pill, and each image's
 *    "below" extra is one line in the caption's type, "Describe it for people who can't see it";
 *  - work: the sidebar's button as the page draws it ("See the work: …", or "Add the work" when
 *    there is none), inert, as the editor's own button is drawn in its place. It is not drawn as
 *    an empty element: on a phone the sidebar sits above the main column, so a button missing from
 *    one page and not the other would move every part below it.
 */

/** The samples, one per layout (the four new ones come with the renderer's second part), and a new exhbt. */
export const SAMPLES = {
  "case-study": () => fullDoc,
  "open-banking": () => openBankingDoc,
  library: () => libraryDoc,
  gallery: () => galleryDoc(GALLERY_IMAGES.map((_, i) => `gallery-${i + 1}`)),
  research: () => researchDoc("research-1"),
  new: () => emptyDoc(),
} satisfies Record<string, () => ExhbtDoc>;
export type SampleName = keyof typeof SAMPLES;
export const isSample = (v: unknown): v is SampleName => typeof v === "string" && v in SAMPLES;

/** A flat grey picture of the image's own size (1200 by 800 when it has none), as a data address, so nothing is stored. */
function picture(w = 1200, h = 800): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#c3c6cd"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** An address for each image in the doc, keyed by its file id. */
export function imageUrlsOf(doc: ExhbtDoc): Record<string, string> {
  return Object.fromEntries(doc.sections.flatMap((s) => (s.kind === "image" && s.fileId ? [[s.fileId, picture(s.w, s.h)]] : [])));
}

const words = (t: string) => t.trim().length > 0;
const hasWords = (rt: { t: string }[]) => rt.some((r) => words(r.t));

/**
 * The doc with every empty optional part given words, so the read-only page draws everything the
 * editing page does: a context line, the three facts with My role, a work link, every box's detail,
 * every caption, a quote's role, every link's description, and words in an empty aim or conclusion.
 */
export function full(doc: ExhbtDoc): ExhbtDoc {
  const section = (s: Section): Section => {
    switch (s.kind) {
      case "image":
        return hasWords(s.caption) ? s : { ...s, caption: text("A caption under the picture") };
      case "quote":
        return words(s.role) ? s : { ...s, role: "Course leader" };
      case "link":
        return words(s.description) ? s : { ...s, description: "One line about the link" };
      case "aim":
      case "conclusion":
        return hasWords(s.text) ? s : { ...s, text: text("A sentence of its own.") };
      default:
        return s;
    }
  };
  return {
    ...doc,
    context: words(doc.context) ? doc.context : "Year 2 module",
    whereWhen: words(doc.whereWhen ?? "") ? doc.whereWhen : "University of Leeds, May 2026",
    myRole: words(doc.myRole ?? "") ? doc.myRole : "Lead analyst",
    gap: hasWords(doc.gap) ? doc.gap : [{ t: "Queues ran long at lunch. " }, { t: "Would a second till help?", b: true }],
    evidence: doc.evidence ?? { kind: "link", href: "https://example.com/the-work", label: "The report (PDF)" },
    flow: doc.flow.map((b) => (words(b.detail ?? "") ? b : { ...b, detail: "two weeks" })),
    sections: doc.sections.map(section),
  };
}

const PILL = "xp-pill px-2 py-[0.2rem] text-[0.78rem] font-medium";
const muted = { color: "var(--xp-muted)" } as const;

/** The stand-in adapter for `doc`, drawn with `ctx` (whose `edit` is this adapter). */
export function standIn(doc: ExhbtDoc, base: Omit<PageCtx, "edit">, evidenceUrl: string | null): EditAdapter {
  const items = new Map(pageItems(doc).map((it) => [it.id, it]));
  const copy = FORMAT_COPY[formatOf(doc)];
  /** The words, or the placeholder in --xp-muted. */
  const shown = (value: string, placeholder: string) => (value.trim() ? value : <span style={muted}>{placeholder}</span>);

  const adapter: EditAdapter = {
    text: (o) => (
      <span data-slot="text" data-path={o.path} data-label={o.label} data-empty={o.value.trim() ? undefined : ""} id={o.id} style={{ display: "contents" }}>
        {shown(o.value, o.placeholder)}
      </span>
    ),
    rich: (o) => {
      const field = (
        <span data-slot="rich" data-path={o.path} data-label={o.label} data-empty={hasWords(o.value) ? undefined : ""} style={{ display: "contents" }}>
          {hasWords(o.value) ? <RichText value={o.value} highlight={o.highlight} /> : <span style={muted}>{o.placeholder}</span>}
        </span>
      );
      return o.className ? (
        <div className={o.className} data-slot-box={o.path}>
          {field}
        </div>
      ) : (
        field
      );
    },
    item: (o) => {
      const item = items.get(o.id);
      return (
        <div data-slot="item" data-id={o.id} data-as={o.as} data-index={o.index} data-count={o.count} className={`${o.rowClass} min-w-0`.trim()}>
          {item && <ItemView item={item} as={o.as} ctx={ctx} />}
        </div>
      );
    },
    insert: (o) => <span data-slot="insert" data-at={o.at} data-end={o.end ? "" : undefined} hidden />,
    extra: (o) =>
      o.where === "below" ? (
        <span data-slot="extra" data-section={o.sectionId} data-kind={o.kind} data-where="below" data-edit-only="image-description" inert className="mt-1 block text-sm leading-snug" style={muted}>
          Describe it for people who can&apos;t see it
        </span>
      ) : (
        <span data-slot="extra" data-section={o.sectionId} data-kind={o.kind} data-where={o.where} hidden />
      ),
    // "Add a finding" is the list's last child, inside the <ul>: an <li>, so the list stays a list.
    list: (o) => (o.index === o.n ? <li data-slot="list" data-path={o.path} data-index={o.index} data-n={o.n} hidden /> : <span data-slot="list" data-path={o.path} data-index={o.index} data-n={o.n} hidden />),
    flow: {
      list: (o) => (
        <div data-slot="flow-list" data-count={o.count} data-stack={o.stack ? "" : undefined} style={{ display: "contents" }}>
          {o.children}
        </div>
      ),
      box: (o) => (
        <li key={o.index} data-slot="flow-box" data-index={o.index} className={o.className}>
          {o.children}
        </li>
      ),
      tools: (o) => <span data-slot="flow-tools" data-index={o.index} hidden />,
      add: (o) => <span data-slot="flow-add" data-after={o.after} hidden />,
    },
    skills: () => (
      <ul aria-label={copy.skills} data-slot="skills" className="flex flex-wrap gap-1 @2xl/main:justify-end">
        {doc.skills.map((s) => (
          <li key={s} className={PILL}>
            {s}
          </li>
        ))}
        <li id="skill-new" data-edit-only="add-skill" inert className={PILL} style={muted}>
          Add a skill
        </li>
      </ul>
    ),
    work: () => (
      <div data-slot="work" data-empty={doc.evidence ? undefined : ""} inert>
        <Button href={evidenceUrl ?? "#"} variant="primary" size="md" className="xp-work-button w-full" label={doc.evidence ? `See the work: ${doc.evidence.label}` : "Add the work"}>
          <span className="min-w-0">{doc.evidence ? `See the work: ${doc.evidence.label}` : "Add the work"}</span>
        </Button>
      </div>
    ),
    tools: (o) => <span data-slot="tools" data-block={o.block} hidden />,
  };
  const ctx: PageCtx = { ...base, edit: adapter };
  return adapter;
}
