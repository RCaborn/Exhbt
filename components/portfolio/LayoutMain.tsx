import { Fragment } from "react";
import { filledFlow, isBlank, type ContentSection, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, refsHeading, titleShown } from "@/lib/exhbt/formats";
import { pageItems, rowsFor, type Cell, type ItemAs, type ItemCell, type PageItem, type Row, type StackCell } from "@/lib/exhbt/layouts";
import { imageRatio } from "@/lib/exhbt/sections";
import { AimStacked, ButtonLink, ClosingBlock, Figure, Findings, FlowPart, KeyFigure, LeadImage, PlainSection, RefLine, StagedImage, TileImage } from "./exhbt-parts";
import { cellClass, cellItemClass, rowClass, stackClass, stackEditClass, stackIsRow, stackItemClass } from "./layout-rows";
import type { ImageUrls, PageCtx } from "./page-ctx";

/*
 * The main column of every layout below the context line (decision 0027): one renderer. It asks
 * the layout engine for the page's items in order (pageItems) and for its rows (rowsFor), and draws
 * each row with the page's parts (exhbt-parts.tsx) and the row classes in layout-rows.ts. Nothing is
 * reordered to make a row. Server-safe: no hooks, no "use client".
 *
 * On a public page an image with no address and a section with nothing to show (isBlank: an aim with no
 * words, a quote nobody has typed, a graph nobody has filled in) are left out before the order is worked
 * out, and so is a flowchart with no box filled in; its empty boxes are never drawn (decision 0032; before
 * it only an aim or a conclusion could be empty on a public page). With `ctx.edit` (decision 0026)
 * nothing is left out, a "+" goes before each row and after the last, and each item is the editor's
 * frame (`ctx.edit.item`), which draws the item with ItemView itself; the wrappers of pairs, stacks
 * and groups are drawn here on both pages. In edit mode the rows depend only on what structureKey
 * reads (the layout, flowOff, and each item's id, kind and image stage); a grid tile's shape (its
 * picture's size) is the one exception, as its cell is the row's.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** What the read-only page leaves out before it pairs anything (decision 0027, "Reading what is drawn"): a picture it has no address for, and a section with nothing to show (decision 0032). */
export const readOnlySkip =
  (imageUrls: ImageUrls) =>
  (s: ContentSection): boolean =>
    (s.kind === "image" && !imageUrls[s.fileId]) || isBlank(s);

/** The page's items as a visitor sees them: the flowchart with only its filled boxes, and not at all when none is filled. */
export function readOnlyItems(doc: ExhbtDoc, imageUrls: ImageUrls): PageItem[] {
  return pageItems(doc, readOnlySkip(imageUrls)).flatMap((it): PageItem[] => {
    if (it.kind !== "flow") return [it];
    const steps = filledFlow(it.steps);
    return steps.length === 0 ? [] : steps.length === it.steps.length ? [it] : [{ ...it, steps }];
  });
}

/** The first item of a row, in page order. */
const firstItem = (row: Row): PageItem => {
  const first = (c: Cell): PageItem => (c.cell === "item" ? c.item : c.items[0]!.item);
  return row.row === "one" ? first(row.cell) : row.row === "pair" ? first(row.left) : row.items[0]!.item;
};

/** The main column below the context line: the rows of rowsFor(pageItems(doc), format), drawn in order. */
export function LayoutMain({ doc, ctx }: { doc: ExhbtDoc; ctx: PageCtx }) {
  const f = ctx.format;
  const edit = ctx.edit;
  const all = edit ? pageItems(doc) : readOnlyItems(doc, ctx.imageUrls);
  // A flowchart with no boxes is not drawn for a visitor (decision 0032), so the rows round it are laid out without it,
  // as a visitor's are; the editor draws it as a row of its own in its place, the "Add a box" placeholder, which nothing
  // pairs with. Taken out, the editing page is the visitor's. A flowchart with boxes, blank ones too, keeps its place in
  // the rows, so typing in a box never moves the page; only the first "Add a box" does, as adding a section does.
  const emptyFlow = edit ? all.find((it): it is Extract<PageItem, { kind: "flow" }> => it.kind === "flow" && it.steps.length === 0) : undefined;
  const items = emptyFlow ? all.filter((it) => it !== emptyFlow) : all;
  const rows = rowsFor(items, f);
  // Places are the page's, with the empty flowchart counted: what "+" adds at and what a frame says of its place.
  const placeOf = new Map(all.map((it, i) => [it.id, i]));
  let refsDrawn = 0;

  /** One item. Read-only: drawn here with `rc` for its place. Editing: the editor's frame, given `slotClass` (the row's classes for a lone item, else ""). */
  const item = (c: ItemCell, rc: string, slotClass = "") =>
    edit ? (
      <Fragment key={c.item.id}>{edit.item({ id: c.item.id, kind: c.item.kind, as: c.as, rowClass: slotClass, index: placeOf.get(c.item.id) ?? -1, count: all.length })}</Fragment>
    ) : (
      <ItemView key={c.item.id} item={c.item} as={c.as} ctx={ctx} rowClass={rc} />
    );

  /** A stack's items: on the read-only page each takes the classes for following another; on the editing page the wrapper spaces the frames. */
  const stackItems = (st: StackCell) => st.items.map((c, i) => item(c, stackItemClass(st.name, i)));
  const stackEl = (st: StackCell) => {
    const cls = cx(stackClass(st.name, f), edit && stackEditClass(st.name));
    return st.name === "happened" ? (
      <div key={st.items[0]!.item.id} data-part="happened" className={cls}>
        {stackItems(st)}
      </div>
    ) : (
      <div key={st.items[0]!.item.id} className={cls}>
        {stackItems(st)}
      </div>
    );
  };
  const cellEl = (c: Cell) => (c.cell === "item" ? item(c, "") : stackEl(c));

  function drawRow(row: Row, first: boolean): React.ReactNode {
    const rc = rowClass(row, f, first);
    switch (row.row) {
      case "one": {
        const c = row.cell;
        if (c.cell === "item") return item(c, rc, rc);
        if (stackIsRow(c.name)) return <div className={cx(rc, edit && stackEditClass(c.name))}>{stackItems(c)}</div>;
        return <div className={rc}>{stackEl(c)}</div>;
      }
      case "pair":
        return (
          <div data-found={row.ratio === "found" || undefined} className={rc}>
            {cellEl(row.left)}
            {cellEl(row.right)}
          </div>
        );
      case "group":
        switch (row.of) {
          case "graphs":
          case "images":
            return (
              <div aria-label={row.of === "graphs" ? "Graphs" : "Images"} role="group" className={rc}>
                {row.items.map((c) => item(c, ""))}
              </div>
            );
          case "figures":
            return (
              <div role="group" aria-label="More figures" data-part="figures" className={rc}>
                {row.items.map((c) => item(c, ""))}
              </div>
            );
          case "grid":
            return (
              <ul role="list" aria-label="More images" data-part="grid" className={rc}>
                {row.items.map((c) => (
                  <li key={c.item.id} className={cellClass("grid")} style={{ "--r": c.item.kind === "image" ? imageRatio(c.item.s as Extract<ContentSection, { kind: "image" }>) : 4 / 3 } as React.CSSProperties}>
                    {item(c, "")}
                  </li>
                ))}
              </ul>
            );
          case "links":
            return (
              <div className={rc}>
                {row.items.map((c) => (
                  <div key={c.item.id} className={cellClass("links")}>
                    {item(c, cellItemClass("links"))}
                  </div>
                ))}
              </div>
            );
          case "refs": {
            // One list per page in practice; a second (an arranged page) gets its own heading id. Its title is the doc's
            // refsTitle (decision 0032): the layout's own heading until the person types one, none once they clear it.
            // On the editing page the heading is the editor's field, which reads the title itself, so the shell need not
            // draw again as it is typed; a second list on the page shows the same title, read-only.
            const id = refsDrawn++ === 0 ? "refs-h" : `${row.items[0]!.item.id}-refs-h`;
            const layout = refsHeading(f);
            const shown = edit ? layout : titleShown(doc.refsTitle, layout);
            return (
              <section {...(shown ? { "aria-labelledby": id } : { "aria-label": layout })} data-part="references" className={rc}>
                {edit ? (
                  edit.title({ Sub: ctx.Sub, id, className: "xp-label", path: "refsTitle", fallback: layout, label: `${layout}: title` })
                ) : shown ? (
                  <ctx.Sub id={id} className="xp-label">
                    {shown}
                  </ctx.Sub>
                ) : null}
                <ul className={shown ? "mt-1" : undefined}>
                  {row.items.map((c) => (
                    <li key={c.item.id} className={cellClass("refs")}>
                      {item(c, "")}
                    </li>
                  ))}
                </ul>
              </section>
            );
          }
          case "buttons":
            return <div className={rc}>{row.items.map((c) => item(c, ""))}</div>;
          case "before-after":
            return (
              <div role="group" aria-label="Before and after" className={rc}>
                {row.items.map((c) => item(c, ""))}
              </div>
            );
        }
    }
  }

  // A row of one item is keyed by that item, so it keeps its node wherever it goes. A pair or a group is keyed by its
  // shape and its count among rows of that shape, so when the items in it change its frames are moved, not drawn anew.
  const seen = new Map<string, number>();
  const keyOf = (row: Row): string => {
    if (row.row === "one") return firstItem(row).id;
    const shape = row.row === "pair" ? `pair:${row.ratio}` : `group:${row.of}`;
    const n = seen.get(shape) ?? 0;
    seen.set(shape, n + 1);
    return `${shape}#${n}`;
  };

  const flowAt = emptyFlow ? (placeOf.get(emptyFlow.id) ?? 0) : -1;
  /** The empty flowchart's own row, edit-only (e2e/page-editor.ts EDIT_ONLY_IN_FLOW): the lone flowchart's classes, with the "+" before it. */
  const emptyFlowRow = (beforeAll: boolean) =>
    emptyFlow && (
      <Fragment key="empty-flow">
        {edit?.insert({ at: flowAt })}
        <div data-empty-flow="">{item({ cell: "item", item: emptyFlow, as: "plain" }, "", rowClass({ row: "one", cell: { cell: "item", item: emptyFlow, as: "plain" } }, f, beforeAll))}</div>
      </Fragment>
    );
  let flowDrawn = !emptyFlow;

  return (
    <>
      {rows.map((row, r) => {
        const at = placeOf.get(firstItem(row).id) ?? 0;
        const flowHere = !flowDrawn && flowAt < at;
        if (flowHere) flowDrawn = true;
        return (
          <Fragment key={keyOf(row)}>
            {flowHere && emptyFlowRow(r === 0)}
            {edit?.insert({ at })}
            {drawRow(row, r === 0)}
          </Fragment>
        );
      })}
      {!flowDrawn && emptyFlowRow(rows.length === 0)}
      {edit?.insert({ at: all.length, end: true })}
    </>
  );
}

/** One page item, drawn the way `as` says. `rowClass` goes on its root (read-only page); the editor's frame leaves it out and carries those classes itself. */
export function ItemView({ item, as, ctx, rowClass = "" }: { item: PageItem; as: ItemAs; ctx: PageCtx; rowClass?: string }): React.ReactNode {
  if (item.kind === "flow") return <FlowPart steps={item.steps} title={item.title} as={as} rowClass={rowClass} ctx={ctx} />;
  const { Sub, imageUrls, format: f, edit } = ctx;
  const copy = FORMAT_COPY[f];
  const s = item.s;
  const at = item.index;
  const wrap = (node: React.ReactNode) => (rowClass ? <div className={rowClass}>{node}</div> : node);
  switch (s.kind) {
    case "findings":
      if (as === "kicker") return wrap(<Findings s={s} Sub={Sub} heading={copy.findings} part="results" kicker ctx={ctx} at={at} />);
      if (as === "stacked") return <Findings s={s} Sub={Sub} heading={copy.findings} ctx={ctx} at={at} />;
      break;
    case "graph":
    case "image":
      if (s.kind === "image" && !imageUrls[s.fileId] && !edit) return null;
      if (as === "key") return <KeyFigure s={s} imageUrls={imageUrls} rowClass={rowClass} ctx={ctx} at={at} />;
      if (as === "lead" && s.kind === "image") return <LeadImage s={s} imageUrls={imageUrls} rowClass={rowClass} ctx={ctx} at={at} />;
      if (as === "tile" && s.kind === "image") return <TileImage s={s} imageUrls={imageUrls} ctx={ctx} at={at} />;
      if ((as === "before" || as === "after") && s.kind === "image") return <StagedImage s={s} stage={as} imageUrls={imageUrls} ctx={ctx} at={at} />;
      // In a stack ("What happened") or a pair: the figure alone, its own root in the column.
      if (as === "stacked" || !rowClass) return <Figure s={s} imageUrls={imageUrls} zoom={f !== "case-study" && as !== "stacked"} ctx={ctx} at={at} />;
      break;
    case "aim":
      if (as === "stacked") return <AimStacked s={s} rowClass={rowClass} ctx={ctx} at={at} />;
      break;
    case "conclusion":
      if (as === "stacked") return <ClosingBlock s={s} label="Conclusion" rowClass={rowClass} ctx={ctx} at={at} />;
      break;
    case "reflection":
      if (as === "stacked") return <ClosingBlock s={s} label={copy.reflection} rowClass={rowClass} ctx={ctx} at={at} />;
      break;
    case "link":
      if (as === "listed") return <RefLine s={s} ctx={ctx} at={at} />;
      if (as === "button") return <ButtonLink s={s} ctx={ctx} at={at} />;
      break;
  }
  // "plain": the section on its own row, as SectionBlock draws it, with the row's classes.
  return <PlainSection s={s} Sub={Sub} imageUrls={imageUrls} format={f} rowClass={rowClass} ctx={ctx} at={at} />;
}
