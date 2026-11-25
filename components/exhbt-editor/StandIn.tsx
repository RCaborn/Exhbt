import { RichText } from "@/components/exhbt/RichText";
import { ItemView } from "@/components/portfolio/LayoutMain";
import type { EditAdapter, PageCtx } from "@/components/portfolio/page-ctx";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { Button } from "@/components/ui/Button";
import type { ExhbtDoc, RichText as RichTextValue } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, formatOf } from "@/lib/exhbt/formats";
import { pageItems, rowsFor, type Cell, type ItemAs } from "@/lib/exhbt/layouts";
import type { PageEditorProps } from "./context";
import { ADD_SKILL_BUTTON, ADD_SKILL_CHIP, CANVAS, DESCRIPTION_PLACEHOLDER, descriptionClass, LOOK_GROUND, MUTED, PILL, SKILLS_LIST, TOPBAR_H, workWords } from "./geometry";
import { visitorParts } from "./visitor-parts";

/*
 * The loading stand-in (decision 0026, "The crash fallback"). The new editor is drawn only in the
 * browser, so until its chunk has loaded the edit page shows the page drawn with this static adapter:
 * the same slots, with everything 0026 puts in the flow in the editor only (EDIT_ONLY_IN_FLOW) drawn
 * inert, and every other control left out, as controls take no room. The empty parts' placeholders,
 * each image's description field and the "Add a skill" box are where the editor will put them, so the
 * fields come alive in place and nothing moves when the editor arrives.
 *
 * No hooks and no state: this file is in the gate's own chunk (EditorGate.tsx), and the gate draws it
 * on the server too, as the loading view. Nothing here carries a field's id or data-path, so a test
 * or a jump that looks for a field never lands on the stand-in. The geometry (the pill, the work
 * button, the frame's classes) is the slot harness's (app/dev/edit-slots/stand-in.tsx), which the
 * box-for-box test in e2e/edit-slots.spec.ts checks against the visitor's page.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
const hasWords = (rt: RichTextValue) => rt.some((r) => r.t.trim());
const muted = MUTED;

/** An empty field's placeholder, in the part's own element and type, its words in --xp-muted. */
const placeholder = (words: string) => (
  <span data-edit-only="placeholder" inert style={muted}>
    {words}
  </span>
);

/** How each item on the page is drawn (its `as`), by id, from the layout engine's own rows. */
function drawnAs(doc: ExhbtDoc): Map<string, ItemAs> {
  const out = new Map<string, ItemAs>();
  const visit = (c: Cell) => (c.cell === "item" ? void out.set(c.item.id, c.as) : c.items.forEach(visit));
  for (const row of rowsFor(pageItems(doc), formatOf(doc))) {
    if (row.row === "one") visit(row.cell);
    else if (row.row === "pair") [row.left, row.right].forEach(visit);
    else row.items.forEach(visit);
  }
  return out;
}

/**
 * The adapter the loading view draws with: everything 0026 puts in the flow in the editor only
 * (EDIT_ONLY_IN_FLOW), inert; every other control left out. `ctx` is the context ProjectView gives
 * the page parts (its Sub follows the heading level: "h3" under headingLevel="h2"); the item slot
 * draws ItemView with it, so the parts inside a frame call this adapter's slots too.
 *
 * It takes the doc, unlike the brief's `standInAdapter()`: the item, skills, work and description
 * slots carry ids, not content, so a stand-in with no doc could not draw them.
 */
export function standInAdapter(doc: ExhbtDoc, base: Omit<PageCtx, "edit">): EditAdapter {
  const items = new Map(pageItems(doc).map((it) => [it.id, it]));
  const sections = new Map(doc.sections.map((s) => [s.id, s]));
  const as = drawnAs(doc);
  const copy = FORMAT_COPY[formatOf(doc)];

  const adapter: EditAdapter = {
    text: (o) => (o.value.trim() ? o.value : placeholder(o.placeholder)),
    rich: (o) => {
      const inner = hasWords(o.value) ? <RichText value={o.value} highlight={o.highlight} /> : placeholder(o.placeholder);
      // A <p> on the page is the field's <div> in the editor, with the paragraph's classes.
      return o.className ? <div className={o.className}>{inner}</div> : inner;
    },
    // As G's frame will: a <div> with the row's classes round the part, which is drawn without them.
    item: (o) => {
      const item = items.get(o.id);
      return (
        <div data-stand-in={o.id} className={cx(o.rowClass, "min-w-0")}>
          {item && <ItemView item={item} as={o.as} ctx={ctx} />}
        </div>
      );
    },
    insert: () => null,
    // Of the extras only an image's description is in the flow; the others are drawn over the part.
    extra: (o) => {
      if (o.where !== "below") return null;
      const s = sections.get(o.sectionId);
      const alt = s && s.kind === "image" ? s.alt.trim() : "";
      return (
        <span data-edit-only="image-description" inert className={descriptionClass(as.get(o.sectionId))} style={alt ? undefined : muted}>
          {alt || DESCRIPTION_PLACEHOLDER}
        </span>
      );
    },
    list: () => null,
    flow: {
      list: (o) => o.children,
      box: (o) => (
        <li key={o.index} className={o.className}>
          {o.children}
        </li>
      ),
      tools: () => null,
      add: () => null,
    },
    // The read-only pills, then the "Add a skill" box the size of a pill: on an exhbt with no skills it is the block's placeholder.
    skills: () => (
      <ul aria-label={copy.skills} className={SKILLS_LIST}>
        {doc.skills.map((s) => (
          <li key={s} className={PILL}>
            {s}
          </li>
        ))}
        <li data-edit-only="add-skill" inert className={PILL} style={muted}>
          Add a skill
        </li>
        {/* On a touch screen the box's Add button, inert, as the editor draws it. */}
        <li data-edit-only="add-skill-button" inert aria-hidden className={ADD_SKILL_BUTTON}>
          <span className={ADD_SKILL_CHIP}>Add</span>
        </li>
      </ul>
    ),
    // The sidebar's button as the page draws it, or "Add the work"; never left out, as on a phone the sidebar sits above the page.
    work: () => {
      const words = workWords(doc.evidence?.label);
      return (
        <div inert data-edit-only={doc.evidence ? undefined : "placeholder"}>
          <Button href="#" variant="primary" size="md" className="xp-work-button w-full" label={words}>
            <span className="min-w-0">{words}</span>
          </Button>
        </div>
      );
    },
    tools: () => null,
  };
  const ctx: PageCtx = { ...base, edit: adapter };
  return adapter;
}

/**
 * The editing page as the stand-in draws it: an empty bar where the top bar will be (`--xe-topbar-h`,
 * which G defines and H's bar is exactly as tall as), then the canvas, in the person's look at the
 * public frame's width (app/(portfolio)/p/[username]/[slug]/layout.tsx), holding the page one heading
 * level down. The gate's loading view and the editor's stub both draw this. The canvas is inert: a
 * link in the words must not open while the page is not yet the editor.
 */
export function StandInPage(props: PageEditorProps) {
  const { initialDoc: doc, theme, imageUrls, owner } = props;
  const edit = standInAdapter(doc, { Sub: "h3", imageUrls, format: formatOf(doc) });
  const evidenceUrl = doc.evidence?.kind === "link" ? doc.evidence.href : props.fileEvidenceUrl;
  return (
    <>
      <div aria-hidden className="border-b border-line bg-surface" style={{ height: TOPBAR_H }} />
      <div {...lookAttrs(theme)} style={themeStyle(theme)} className={LOOK_GROUND}>
        <div inert className={CANVAS}>
          <ProjectView
            doc={doc}
            // As the visitor's page has it: the look's photo shape and "All of <name>'s work", which the editing page draws but does not open.
            owner={{ ...owner, shape: theme.photo, homeHref: props.liveBase ?? "/portfolio" }}
            imageUrls={imageUrls}
            evidenceUrl={evidenceUrl}
            headingLevel="h2"
            confirmed={false}
            edit={edit}
            // Save as PDF, the checked-on line and the team byline, as the editing page draws them.
            {...visitorParts(props, props.publishedAt)}
          />
        </div>
      </div>
    </>
  );
}
