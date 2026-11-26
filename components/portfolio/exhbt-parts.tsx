/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see Avatar.tsx. */
import { ArrowUpRight } from "lucide-react";
import { Chart } from "@/components/charts/Chart";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { ImageZoom } from "@/components/portfolio/ImageZoom";
import { attributionOf, hasWords, isFormatted, richOf, safeHref, trimRuns, type FlowStep, type RichText as RichTextValue, type Section, type SectionOf } from "@/lib/exhbt/blocks";
import { flowHeading, FORMAT_COPY, sectionHeading, titleShown, type Format } from "@/lib/exhbt/formats";
import type { ItemAs } from "@/lib/exhbt/layouts";
import { imageRatio, leadRatio } from "@/lib/exhbt/sections";
import type { ImageUrls, PageCtx, Sub } from "./page-ctx";

/**
 * The parts of an exhbt page (decisions 0022, 0024 and 0027): the findings, a figure, any one
 * section on its own, the flowchart's section, and the drawings particular to a layout (the
 * gallery's lead image and tiles, research's key figure, its stacked aim and closing blocks, a
 * reference in its list). LayoutMain (the one renderer) draws every layout with them; the classic
 * editor's arrange preview draws SectionBlock. Server-safe, no hooks. Their defaults are the case
 * study's, so a call with no options draws what the case study always drew.
 *
 * Each part takes an optional `ctx` (components/portfolio/page-ctx.ts) and `at`, its index in
 * doc.sections. On a public page `ctx.edit` is absent and the part's markup is exactly what it was.
 * With `ctx.edit` (the edit-on-page editor, decision 0026) every text is a slot at its issue path,
 * an empty part is drawn with its field so its placeholder shows, nothing is a link or opens larger,
 * and the edit-only controls are slots called as the last child of a box that is `relative` in
 * edit mode only, so what the adapter returns sits over the part and takes no room.
 *
 * Decision 0032: a part's heading is the layout's own until the person types a title (`Title`), a quote,
 * a pull quote and a link's description draw their bold and italic (`wordsOf`), and a finding with no
 * words, a quote's missing name and a cleared heading are simply not drawn for a visitor. A page with no
 * title typed and nothing formatted is drawn byte for byte as it was.
 */

/** Defined in page-ctx.ts; re-exported here, where they were first, so older imports keep working. */
export type { ImageUrls, Sub };

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
/** A box the editor draws its controls over: positioned in edit mode only, so the public page's markup is unchanged. */
const rel = (ctx?: PageCtx) => (ctx?.edit ? "relative" : "");
/** The field paths of a section's parts, as validateForPublish reports them. */
const p = (at: number | undefined, field: string) => `sections.${at ?? -1}.${field}`;
/** The first sentence of a hint, as a short placeholder on the page. */
export const firstSentence = (s: string) => s.match(/^[^.?!]*[.?!]/)?.[0] ?? s;

/**
 * Words stored as a plain string with their bold and italic beside it (decision 0032: a quote's, a pull
 * quote's, a link's description), as the public page draws them. With nothing formatted it is exactly the
 * trimmed string, so a page nobody has formatted is byte for byte the page it was.
 */
function wordsOf(plainWords: string, runs: RichTextValue | undefined): React.ReactNode {
  const rich = richOf(plainWords, runs);
  return isFormatted(rich) ? <RichText value={trimRuns(rich)} /> : plainWords.trim();
}

/**
 * A part's heading (decision 0032): the layout's own until the person types a title, theirs from then on, and
 * none once they have cleared it. On the editing page it is the editor's field, in the heading's own element
 * and classes, there even when cleared so the title can come back. `name` is what the part is called.
 */
/**
 * A part's own title may be one long word (a hashtag, an event's name in capitals): it breaks where it must rather
 * than run off a phone's screen. The same on the editing page and the visitor's, so the two stay box for box.
 */
export const TITLE_WRAP = "wrap-anywhere";

function Title({ Sub, id, className: given, own, layout, path, name, ctx }: { Sub: Sub; id: string; className: string; own: string | undefined; layout: string; path: string; name: string; ctx?: PageCtx }): React.ReactNode {
  const className = cx(given, TITLE_WRAP);
  if (ctx?.edit) return ctx.edit.title({ Sub, id, className, path, fallback: layout, label: `${name}: title` });
  const shown = titleShown(own, layout);
  return shown ? (
    <Sub id={id} className={className}>
      {shown}
    </Sub>
  ) : null;
}

/**
 * A titled part's name for a screen reader: its heading while one is drawn, else `name`. On the editing page
 * the heading's element is always there where the layout has a heading (cleared, it holds the empty field),
 * and where the layout has none (a case study's flowchart) the part keeps its name.
 */
const labelled = (id: string, own: string | undefined, layout: string, name: string, ctx?: PageCtx): { "aria-labelledby": string } | { "aria-label": string } =>
  (ctx?.edit ? layout : titleShown(own, layout)) ? { "aria-labelledby": id } : { "aria-label": name };

/** A heading over a rule, then the findings as a ruled list. "What I found", "What happened" or "Results". */
const FINDING = "xp-finding border-b py-3.5 text-[0.9375rem] leading-relaxed last:border-b-0 print:py-1 print:text-[0.9rem] print:leading-snug";
/**
 * In edit mode the list's last child is "Add a finding" (the adapter's list slot), so the last finding is no
 * longer :last-child; this keeps its bottom rule off, as on the page.
 */
const LAST_FINDING_EDIT = "[&:nth-last-child(1_of_.xp-finding)]:border-b-0";
/** The large heading over a rule: "What I found", and the flowchart's where a layout gives it one ("What I did"). */
const BIG_HEADING = "xp-found-heading xp-display border-b pb-3 text-[1.5rem] leading-tight print:pb-1.5 print:text-[1.25rem]";

export function Findings({
  s,
  Sub,
  heading = "What I found",
  part = "findings",
  kicker = false,
  ctx,
  at,
}: {
  s: SectionOf<"findings">;
  Sub: Sub;
  heading?: string;
  part?: string;
  /** The small label heading (research's row of Results, Conclusion and Limitations all use it) instead of the large ruled one. */
  kicker?: boolean;
  ctx?: PageCtx;
  /** Its index in doc.sections, for the field paths in edit mode. */
  at?: number;
}) {
  const edit = ctx?.edit;
  const n = s.items.length;
  const path = p(at, "items");
  const hid = `${s.id}-h`;
  return (
    <section {...labelled(hid, s.title, heading, heading, ctx)} data-part={part} className="min-w-0 break-inside-avoid">
      <Title Sub={Sub} id={hid} className={kicker ? "xp-label" : BIG_HEADING} own={s.title} layout={heading} path={p(at, "title")} name={heading} ctx={ctx} />
      <ul className={edit ? cx(kicker && "mt-1", "relative") : kicker ? "mt-1" : undefined}>
        {s.items.map((f, i) =>
          edit ? (
            <li key={i} className={cx(FINDING, "relative", LAST_FINDING_EDIT)}>
              {edit.rich({ path: `${path}.${i}`, value: f, label: `Finding ${i + 1}`, placeholder: "A finding, in one sentence", className: "" })}
              {edit.list({ path, index: i, n })}
            </li>
          ) : // A finding with no words is not drawn for a visitor (decision 0032).
          hasWords(f) ? (
            <li key={i} className={FINDING}>
              <RichText value={f} />
            </li>
          ) : null,
        )}
        {edit?.list({ path, index: n, n })}
      </ul>
    </section>
  );
}

/** The figure's rounded picture corners: a step inside the card's own. */
const PICTURE_RADIUS = "rounded-[max(0px,calc(var(--xp-radius-card)-8px))]";

/**
 * In edit mode: the picture as the page draws it, but still (it does not open larger), in a box that
 * is positioned so the adapter's "above" slot (the picked-figure label) sits over it. `box` is the
 * class of the element the page wraps the picture in (ImageZoom's button, minus what makes it a
 * button); a picture with no address yet is a quiet box of the picture's shape.
 */
function StillPicture({ s, src, box, img, imgStyle, ctx }: { s: SectionOf<"image">; src: string | null | undefined; box: string; img: string; imgStyle?: React.CSSProperties; ctx: PageCtx }) {
  return (
    <span className={cx("relative block", box)}>
      {src ? (
        <img src={src} alt={s.alt} width={s.w} height={s.h} decoding="async" className={img} style={imgStyle} />
      ) : (
        <span aria-hidden className={cx("block w-full", PICTURE_RADIUS)} style={{ aspectRatio: imageRatio(s), background: "var(--xp-card)" }} />
      )}
      {ctx.edit!.extra({ sectionId: s.id, kind: "image", where: "above" })}
    </span>
  );
}

/** An image's caption: drawn when it has runs; in edit mode always, as a field. */
function Caption({ s, className, ctx, at }: { s: SectionOf<"image">; className: string; ctx?: PageCtx; at?: number }) {
  const edit = ctx?.edit;
  if (edit) {
    return (
      <figcaption className={className}>
        {edit.rich({ path: p(at, "caption"), value: s.caption, label: "Image caption", placeholder: "Add a caption (optional)", className: "" })}
      </figcaption>
    );
  }
  return s.caption.length > 0 ? (
    <figcaption className={className}>
      <RichText value={s.caption} />
    </figcaption>
  ) : null;
}

/** In edit mode: the image's description field, in the flow under the picture and its caption (decision 0026). */
const Below = ({ s, ctx }: { s: SectionOf<"image">; ctx?: PageCtx }) => <>{ctx?.edit?.extra({ sectionId: s.id, kind: "image", where: "below" })}</>;

/**
 * A graph or an image in its card: the key chart beside the findings, or on its own. With `zoom`
 * an image opens larger in a dialog (gallery and research). With `big` an image is roomier: the
 * research poster's key figure, never cropped, at most 34rem tall (80mm in print).
 */
export function Figure({
  s,
  imageUrls,
  zoom = false,
  big = false,
  ctx,
  at,
}: {
  s: SectionOf<"graph"> | SectionOf<"image">;
  imageUrls: ImageUrls;
  zoom?: boolean;
  big?: boolean;
  ctx?: PageCtx;
  /** Its index in doc.sections, for the field paths in edit mode. */
  at?: number;
}) {
  const edit = ctx?.edit;
  if (s.kind === "graph") {
    return (
      <div className={cx("xp-figure min-w-0 break-inside-avoid p-5 print:p-3", rel(ctx))} data-part="graph">
        <Chart data={s.chart} />
        {edit?.extra({ sectionId: s.id, kind: "graph", where: "over" })}
      </div>
    );
  }
  const src = imageUrls[s.fileId];
  if (!src && !edit) return null;
  // An image stored before sizes were kept has none: reserve a 4:3 box (uncropped), so the page doesn't jump as it loads.
  const sized = !s.w || !s.h ? { aspectRatio: imageRatio(s), width: "100%" } : undefined;
  const zoomImg = `mx-auto h-auto max-h-[34rem] w-auto max-w-full object-contain ${PICTURE_RADIUS} ${big ? "print:max-h-[68mm]" : "print:max-h-[34mm]"}`;
  const plainImg = `w-full ${PICTURE_RADIUS} print:max-h-[62mm] print:w-auto`;
  return (
    <figure className={`xp-figure m-0 min-w-0 break-inside-avoid ${big ? "p-5" : "p-4"} print:p-3`} data-part="image">
      {edit ? (
        zoom ? (
          <StillPicture s={s} src={src} box="mx-auto w-full" img={zoomImg} imgStyle={sized} ctx={ctx} />
        ) : (
          <StillPicture s={s} src={src} box="" img={plainImg} ctx={ctx} />
        )
      ) : zoom ? (
        <ImageZoom src={src!} alt={s.alt} caption={s.caption} w={s.w} h={s.h} className="mx-auto w-full cursor-zoom-in" imgStyle={sized} imgClassName={zoomImg} />
      ) : (
        <img src={src!} alt={s.alt} width={s.w} height={s.h} className={plainImg} />
      )}
      <Caption s={s} className="xp-muted mt-2.5 text-sm leading-snug" ctx={ctx} at={at} />
      <Below s={s} ctx={ctx} />
    </figure>
  );
}

/** The gallery's lead image, across the column: its frame has the picture's shape, never taller than 70% of the screen. */
export function LeadImage({ s, imageUrls, rowClass, ctx, at }: { s: SectionOf<"image">; imageUrls: ImageUrls; rowClass: string; ctx?: PageCtx; at?: number }) {
  const edit = ctx?.edit;
  const src = imageUrls[s.fileId];
  if (!src && !edit) return null;
  return (
    <section aria-label="Lead image" data-part="lead" className={rowClass || undefined}>
      <figure className="xp-figure m-0 min-w-0 p-3 break-inside-avoid print:p-2">
        <div className="xp-lead" style={{ aspectRatio: leadRatio(s) }}>
          {edit ? (
            <StillPicture s={s} src={src} box="h-full w-full" img="h-full w-full object-contain" ctx={ctx} />
          ) : (
            <ImageZoom src={src!} alt={s.alt} caption={s.caption} w={s.w} h={s.h} priority className="h-full w-full cursor-zoom-in" imgClassName="h-full w-full object-contain" />
          )}
        </div>
        <Caption s={s} className="xp-muted mt-2.5 px-1 text-sm leading-snug" ctx={ctx} at={at} />
        <Below s={s} ctx={ctx} />
      </figure>
    </section>
  );
}

/** One picture in the gallery's justified rows. Its cell (`li.xp-tile`, with the picture's shape as --r) is the row's, drawn by LayoutMain. */
export function TileImage({ s, imageUrls, ctx, at }: { s: SectionOf<"image">; imageUrls: ImageUrls; ctx?: PageCtx; at?: number }) {
  const edit = ctx?.edit;
  const src = imageUrls[s.fileId];
  if (!src && !edit) return null;
  return (
    <figure className="m-0">
      {edit ? (
        <StillPicture s={s} src={src} box="w-full" img="xp-tile-img" imgStyle={{ aspectRatio: "var(--r)" }} ctx={ctx} />
      ) : (
        <ImageZoom src={src!} alt={s.alt} caption={s.caption} w={s.w} h={s.h} className="w-full cursor-zoom-in" imgClassName="xp-tile-img" imgStyle={{ aspectRatio: "var(--r)" }} />
      )}
      <Caption s={s} className="xp-muted mt-1.5 text-[0.8125rem] leading-snug [overflow-wrap:anywhere] print:text-[0.75rem]" ctx={ctx} at={at} />
      <Below s={s} ctx={ctx} />
    </figure>
  );
}

/** Research's key figure: the first graph or image, large, beside the aim and the method. */
export function KeyFigure({ s, imageUrls, rowClass, ctx, at }: { s: SectionOf<"graph"> | SectionOf<"image">; imageUrls: ImageUrls; rowClass: string; ctx?: PageCtx; at?: number }) {
  return (
    <div data-part="key-figure" className={cx("min-w-0", rowClass)}>
      <Figure s={s} imageUrls={imageUrls} zoom big ctx={ctx} at={at} />
    </div>
  );
}

/**
 * The flowchart's section, as each layout draws it:
 *  - a case study: the bare section, no heading (named "Process");
 *  - research: "Method", a small label over the boxes as a column (it always sits in the method stack);
 *  - the others: the layout's heading ("What I did") over a rule, the boxes a column when they sit
 *    beside "What happened" (`as` "stacked") and a row that fits the room when on their own.
 * `rowClass` is its place: on the section itself, or for a heading-and-boxes section on its own, on
 * the grid today's gallery puts round it.
 *
 * `title` is the person's own (doc.flowTitle, decision 0032): it takes the place of the layout's heading,
 * "" draws none, and in a case study, which has no heading of its own, it is a small label over the boxes.
 */
export function FlowPart({ steps, title, as, rowClass = "", ctx }: { steps: FlowStep[]; title?: string; as: ItemAs; rowClass?: string; ctx: PageCtx }) {
  const { Sub, format } = ctx;
  const copy = FORMAT_COPY[format];
  const layout = flowHeading(format);
  // Whether a heading sits over the boxes: on the editing page the layout's own always does (cleared, it is the field that brings it back).
  const headed = Boolean(ctx.edit ? layout : titleShown(title, layout));
  if (format === "case-study") {
    return (
      <section {...labelled("flow-h", title, layout, copy.flow, ctx)} data-part="process" className={cx(rowClass, "break-inside-avoid")}>
        <Title Sub={Sub} id="flow-h" className="xp-label mb-2" own={title} layout={layout} path="flowTitle" name="Flowchart" ctx={ctx} />
        <MethodFlow steps={steps} variant="page" ctx={ctx} />
      </section>
    );
  }
  if (format === "research") {
    return (
      <section {...labelled("method-h", title, layout, copy.flow, ctx)} data-part="process" className={cx("break-inside-avoid", rowClass)}>
        <Title Sub={Sub} id="method-h" className="xp-label" own={title} layout={layout} path="flowTitle" name="Flowchart" ctx={ctx} />
        <div className={headed ? "mt-2" : undefined}>
          <MethodFlow steps={steps} variant="page" stack ctx={ctx} />
        </div>
      </section>
    );
  }
  const stacked = as === "stacked";
  const did = (
    <section {...labelled("did-h", title, layout, copy.flow, ctx)} data-part="did" className={cx("min-w-0 break-inside-avoid", stacked && rowClass)}>
      <Title Sub={Sub} id="did-h" className={BIG_HEADING} own={title} layout={layout} path="flowTitle" name="Flowchart" ctx={ctx} />
      <div className={headed ? "mt-4 print:mt-2" : undefined}>
        <MethodFlow steps={steps} variant="page" stack={stacked} ctx={ctx} />
      </div>
    </section>
  );
  return !stacked && rowClass ? <div className={rowClass}>{did}</div> : did;
}

/**
 * A Build page's link as a button (decision 0028): the look's outline button, "Try the demo", with its
 * line under it. A row of them is the row's (the "buttons" group). In edit mode it is not a link.
 */
export function ButtonLink({ s, ctx, at }: { s: SectionOf<"link">; ctx: PageCtx; at?: number }) {
  const edit = ctx.edit;
  const copy = FORMAT_COPY[ctx.format];
  const href = safeHref(s.href);
  const label = s.label.trim() || copy.link;
  const button = "xp-outline-button inline-flex min-h-11 items-center gap-1.5 px-5 py-2 text-[0.9375rem] leading-tight font-semibold";
  const line = "xp-muted mt-1.5 px-1 text-sm";
  return (
    <div data-part="link" className={cx("min-w-0 break-inside-avoid", rel(ctx))}>
      {edit ? (
        <span className={button}>
          {edit.text({ path: p(at, "label"), value: s.label, label: "What the link is", placeholder: "Try the demo" })}
          <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
        </span>
      ) : href ? (
        <a href={href} rel="nofollow ugc noopener" target="_blank" className={button}>
          {label}
          <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
        </a>
      ) : (
        <span className={button}>{label}</span>
      )}
      {edit
        ? edit.rich({ path: p(at, "description"), value: richOf(s.description, s.descriptionRuns), label: "One line about it (optional)", placeholder: "One line about it (optional)", className: line, beside: true })
        : s.description.trim() && <p className={line}>{wordsOf(s.description, s.descriptionRuns)}</p>}
      {edit?.extra({ sectionId: s.id, kind: "link", where: "over" })}
    </div>
  );
}

/** A picture marked Before or After (decision 0028), in a Before and after pair: a small label over its card. */
export function StagedImage({ s, stage, imageUrls, ctx, at }: { s: SectionOf<"image">; stage: "before" | "after"; imageUrls: ImageUrls; ctx: PageCtx; at?: number }) {
  return (
    <div data-stage={stage} className="min-w-0">
      <p className="xp-label mb-1.5">{stage === "before" ? "Before" : "After"}</p>
      <Figure s={s} imageUrls={imageUrls} zoom ctx={ctx} at={at} />
    </div>
  );
}

/** Research's aim or hypothesis, in the method stack: a ruled block over the method. */
export function AimStacked({ s, rowClass = "", ctx, at }: { s: SectionOf<"aim">; rowClass?: string; ctx: PageCtx; at?: number }) {
  const { Sub, edit } = ctx;
  const heading = s.heading === "hypothesis" ? "Hypothesis" : "Aim";
  const text = "mt-1.5 text-[1.0625rem] leading-relaxed";
  const hid = `${s.id}-h`;
  return (
    <section {...labelled(hid, s.title, heading, heading, ctx)} data-part="aim" className={cx("xp-quote break-inside-avoid border-l-[3px] pl-4", rowClass, rel(ctx))}>
      <Title Sub={Sub} id={hid} className="xp-label" own={s.title} layout={heading} path={p(at, "title")} name={heading} ctx={ctx} />
      {edit ? (
        edit.rich({ path: p(at, "text"), value: s.text, label: heading, placeholder: "What the study set out to find", className: text })
      ) : (
        <p className={text}>
          <RichText value={s.text} />
        </p>
      )}
      {edit?.extra({ sectionId: s.id, kind: "aim", where: "above" })}
    </section>
  );
}

/** Research's conclusion, or its limitations and next steps: a small heading over text, with a hairline above when it follows another (its `rowClass`). */
export function ClosingBlock({ s, label, rowClass = "", ctx, at }: { s: SectionOf<"conclusion"> | SectionOf<"reflection">; label: string; rowClass?: string; ctx: PageCtx; at?: number }) {
  const { Sub, edit } = ctx;
  const text = "mt-1.5 text-[1.0625rem] leading-relaxed";
  const hid = `${s.id}-h`;
  return (
    <section {...labelled(hid, s.title, label, label, ctx)} data-part={s.kind} className={cx("break-inside-avoid", rowClass)}>
      <Title Sub={Sub} id={hid} className="xp-label" own={s.title} layout={label} path={p(at, "title")} name={label} ctx={ctx} />
      {edit ? (
        edit.rich({ path: p(at, "text"), value: s.text, label, placeholder: s.kind === "conclusion" ? "What the study found, in a sentence or two" : FORMAT_COPY[ctx.format].reflectionPlaceholder, className: text })
      ) : (
        <p className={text}>
          <RichText value={s.text} />
        </p>
      )}
    </section>
  );
}

/**
 * A link drawn as one line of a list (research's references): what it is, linked when it has an
 * address, and a line about it. Its line (`li`) is the list's, drawn by LayoutMain, so this is what
 * goes inside it.
 */
export function RefLine({ s, ctx, at }: { s: SectionOf<"link">; ctx: PageCtx; at?: number }) {
  const edit = ctx.edit;
  const copy = FORMAT_COPY[ctx.format];
  const href = safeHref(s.href);
  if (edit) {
    return (
      <div className="relative">
        {href ? (
          <span className="xp-link inline-flex items-start gap-1.5 font-semibold">
            <span>{edit.text({ path: p(at, "label"), value: s.label, label: "What the link is", placeholder: copy.link })}</span>
            <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
          </span>
        ) : (
          <span className="font-semibold">{edit.text({ path: p(at, "label"), value: s.label, label: "What the link is", placeholder: copy.link })}</span>
        )}
        {edit.rich({ path: p(at, "description"), value: richOf(s.description, s.descriptionRuns), label: "One line about it (optional)", placeholder: "One line about it (optional)", className: "xp-muted mt-0.5 block text-sm", beside: true })}
        {edit.extra({ sectionId: s.id, kind: "link", where: "over" })}
      </div>
    );
  }
  const label = s.label.trim() || copy.link;
  return (
    <>
      {href ? (
        <a href={href} rel="nofollow ugc noopener" target="_blank" className="xp-link inline-flex items-start gap-1.5 font-semibold">
          <span>{label}</span>
          <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
        </a>
      ) : (
        <span className="font-semibold">{label}</span>
      )}
      {s.description.trim() && <span className="xp-muted mt-0.5 block text-sm">{wordsOf(s.description, s.descriptionRuns)}</span>}
    </>
  );
}

/** One section on its own, in the page's style: what a lone section is drawn as, and the classic editor's preview while arranging. */
export function SectionBlock({
  s,
  Sub,
  imageUrls,
  format = "case-study",
  ctx,
  at,
}: {
  s: Section;
  Sub: Sub;
  imageUrls: ImageUrls;
  format?: Format;
  ctx?: PageCtx;
  /** Its index in doc.sections, for the field paths in edit mode. */
  at?: number;
}) {
  return <PlainSection s={s} Sub={Sub} imageUrls={imageUrls} format={format} rowClass="xp-section" ctx={ctx} at={at} />;
}

/**
 * A section on its own, with `rowClass` for its place on its root (`xp-section` between rows; the
 * editor's frame carries it and the part is drawn with ""). The findings and a figure, which have no
 * room for it on their own root, are wrapped in an element that carries it.
 */
export function PlainSection({
  s,
  Sub,
  imageUrls,
  format,
  rowClass,
  ctx,
  at,
}: {
  s: Section;
  Sub: Sub;
  imageUrls: ImageUrls;
  format: Format;
  rowClass: string;
  ctx?: PageCtx;
  at?: number;
}) {
  const edit = ctx?.edit;
  const copy = FORMAT_COPY[format];
  const wrap = (node: React.ReactNode) => (rowClass ? <div className={rowClass}>{node}</div> : node);
  switch (s.kind) {
    case "flow":
      return null;
    case "findings":
      return wrap(<Findings s={s} Sub={Sub} heading={copy.findings} ctx={ctx} at={at} />);
    case "graph":
    case "image":
      return s.kind === "image" && !imageUrls[s.fileId] && !edit ? null : wrap(<Figure s={s} imageUrls={imageUrls} zoom={format !== "case-study"} ctx={ctx} at={at} />);
    case "quote": {
      // Who said it is optional, and a role is drawn only with a name (decision 0032): with no name there is no line under the words.
      const by = attributionOf(s);
      const hid = `${s.id}-h`;
      return (
        <section {...labelled(hid, s.title, copy.quote, copy.quote, ctx)} data-part="quote" className={cx(rowClass, "break-inside-avoid")}>
          <Title Sub={Sub} id={hid} className="xp-label" own={s.title} layout={copy.quote} path={p(at, "title")} name={copy.quote} ctx={ctx} />
          <figure className="xp-quote m-0 mt-2 border-l-[3px] pl-4">
            {edit ? (
              <>
                <blockquote className="text-[1.125rem] leading-relaxed">
                  {edit.rich({ path: p(at, "text"), value: richOf(s.text, s.textRuns), label: "The quote, word for word", placeholder: "The quote, word for word", className: "", beside: true, quoted: true })}
                </blockquote>
                <figcaption className="xp-muted mt-1.5 text-sm">
                  {edit.text({ path: p(at, "name"), value: s.name, label: "Who said it", placeholder: "Who said it (optional)" })}
                  {", "}
                  {edit.text({ path: p(at, "role"), value: s.role, label: "Their role (optional)", placeholder: "Their role (optional)" })}
                </figcaption>
              </>
            ) : (
              <>
                <blockquote className="text-[1.125rem] leading-relaxed">“{wordsOf(s.text, s.textRuns)}”</blockquote>
                {by && <figcaption className="xp-muted mt-1.5 text-sm">{by}</figcaption>}
              </>
            )}
          </figure>
        </section>
      );
    }
    case "reflection": {
      const text = "mt-2 max-w-[42rem] text-[1.125rem] leading-relaxed";
      const hid = `${s.id}-h`;
      return (
        <section {...labelled(hid, s.title, copy.reflection, copy.reflection, ctx)} data-part="reflection" className={cx(rowClass, "xp-next break-inside-avoid border-t pt-6 print:pt-2")}>
          <Title Sub={Sub} id={hid} className="xp-label" own={s.title} layout={copy.reflection} path={p(at, "title")} name={copy.reflection} ctx={ctx} />
          {edit ? (
            edit.rich({ path: p(at, "text"), value: s.text, label: copy.reflection, placeholder: copy.reflectionPlaceholder, className: text })
          ) : (
            <p className={text}>
              <RichText value={s.text} />
            </p>
          )}
        </section>
      );
    }
    case "aim":
    case "conclusion": {
      // Only research draws these; elsewhere they are kept but not shown (decision 0024).
      if (format !== "research") return null;
      const heading = sectionHeading(s, format)!;
      const text = "mt-2 max-w-[42rem] text-[1.125rem] leading-relaxed";
      const hid = `${s.id}-h`;
      return (
        <section {...labelled(hid, s.title, heading, heading, ctx)} data-part={s.kind} className={cx(rowClass, "break-inside-avoid", s.kind === "aim" && rel(ctx))}>
          <Title Sub={Sub} id={hid} className="xp-label" own={s.title} layout={heading} path={p(at, "title")} name={heading} ctx={ctx} />
          {edit ? (
            edit.rich({ path: p(at, "text"), value: s.text, label: heading, placeholder: `Your ${heading.toLowerCase()}`, className: text })
          ) : (
            <p className={text}>
              <RichText value={s.text} />
            </p>
          )}
          {s.kind === "aim" && edit?.extra({ sectionId: s.id, kind: "aim", where: "above" })}
        </section>
      );
    }
    case "link": {
      const href = safeHref(s.href);
      const label = s.label.trim() || "Link";
      return (
        <section aria-label={copy.link} data-part="link" className={cx(rowClass, "break-inside-avoid")}>
          <div className={cx("xp-card px-5 py-4 print:px-3 print:py-2", rel(ctx))}>
            {edit ? (
              <>
                {href ? (
                  <span className="xp-link inline-flex items-center gap-1.5 font-semibold">
                    {edit.text({ path: p(at, "label"), value: s.label, label: "What the link is", placeholder: "What the link is" })}
                    <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
                  </span>
                ) : (
                  <p className="font-semibold">{edit.text({ path: p(at, "label"), value: s.label, label: "What the link is", placeholder: "What the link is" })}</p>
                )}
                {edit.rich({ path: p(at, "description"), value: richOf(s.description, s.descriptionRuns), label: "One line about it (optional)", placeholder: "One line about it (optional)", className: "xp-muted mt-0.5 text-sm", beside: true })}
                {edit.extra({ sectionId: s.id, kind: "link", where: "over" })}
              </>
            ) : (
              <>
                {href ? (
                  <a href={href} rel="nofollow ugc noopener" target="_blank" className="xp-link inline-flex items-center gap-1.5 font-semibold">
                    {label}
                    <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} />
                  </a>
                ) : (
                  <p className="font-semibold">{label}</p>
                )}
                {s.description.trim() && <p className="xp-muted mt-0.5 text-sm">{wordsOf(s.description, s.descriptionRuns)}</p>}
              </>
            )}
          </div>
        </section>
      );
    }
    case "pullquote": {
      // An essay's own sentence, large in the look's display face with the quote's rule (decision 0028).
      const big = "xp-quote xp-display border-l-[3px] pl-5 text-[1.75rem] leading-[1.2] text-balance print:text-[1.2rem]";
      return (
        <section aria-label="Pull quote" data-part="pullquote" className={cx(rowClass, "break-inside-avoid")}>
          {edit ? (
            <blockquote className={big}>{edit.rich({ path: p(at, "text"), value: richOf(s.text, s.textRuns), label: "Pull quote", placeholder: "One sentence of your own", className: "", beside: true, quoted: true })}</blockquote>
          ) : (
            <blockquote className={big}>“{wordsOf(s.text, s.textRuns)}”</blockquote>
          )}
        </section>
      );
    }
  }
}
