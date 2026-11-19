import { Fragment } from "react";
import type { ContentSection, ExhbtDoc, RichText } from "@/lib/exhbt/blocks";
import { FORMAT_COPY } from "@/lib/exhbt/formats";
import { pageItems, rowsFor, type Cell, type ItemAs, type ItemCell, type PageItem, type Row, type StackCell } from "@/lib/exhbt/layouts";
import { imageRatio } from "@/lib/exhbt/sections";
import { AimStacked, ClosingBlock, Figure, Findings, FlowPart, KeyFigure, LeadImage, PlainSection, RefLine, TileImage } from "./exhbt-parts";
import { cellClass, cellItemClass, rowClass, stackClass, stackEditClass, stackIsRow, stackItemClass } from "./layout-rows";
import type { ImageUrls, PageCtx } from "./page-ctx";

/*
 * The main column of every layout below the context line (decision 0027): one renderer. It asks
 * the layout engine for the page's items in order (pageItems) and for its rows (rowsFor), and draws
 * each row with the page's parts (exhbt-parts.tsx) and the row classes in layout-rows.ts. Nothing is
 * reordered to make a row. Server-safe: no hooks, no "use client".
 *
 * On a public page an image with no address and an aim or conclusion with no words are left out
 * before the order is worked out, as the pages before release 2 did. With `ctx.edit` (decision 0026)
 * nothing is left out, a "+" goes before each row and after the last, and each item is the editor's
 * frame (`ctx.edit.item`), which draws the item with ItemView itself; the wrappers of pairs, stacks
 * and groups are drawn here on both pages. In edit mode the rows depend only on what structureKey
 * reads (the layout, flowOff, and each item's id, kind and image stage); a grid tile's shape (its
 * picture's size) is the one exception, as its cell is the row's.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
const hasWords = (rt: RichText) => rt.some((r) => r.t.trim());

/** What the read-only page leaves out before it pairs anything (decision 0027, "Reading what is drawn"). */
export const readOnlySkip =
  (imageUrls: ImageUrls) =>
  (s: ContentSection): boolean =>
    (s.kind === "image" && !imageUrls[s.fileId]) || ((s.kind === "aim" || s.kind === "conclusion") && !hasWords(s.text));

/** The first item of a row, in page order. */
const firstItem = (row: Row): PageItem => {
  const first = (c: Cell): PageItem => (c.cell === "item" ? c.item : c.items[0]!.item);
  return row.row === "one" ? first(row.cell) : row.row === "pair" ? first(row.left) : row.items[0]!.item;
};

/** The main column below the context line: the rows of rowsFor(pageItems(doc), format), drawn in order. */
export function LayoutMain({ doc, ctx }: { doc: ExhbtDoc; ctx: PageCtx }) {
  const f = ctx.format;
  const edit = ctx.edit;
  const items = edit ? pageItems(doc) : pageItems(doc, readOnlySkip(ctx.imageUrls));
  const rows = rowsFor(items, f);
  const placeOf = new Map(items.map((it, i) => [it.id, i]));
  let refsDrawn = 0;

  /** One item. Read-only: drawn here with `rc` for its place. Editing: the editor's frame, given `slotClass` (the row's classes for a lone item, else ""). */
  const item = (c: ItemCell, rc: string, slotClass = "") =>
    edit ? (
      <Fragment key={c.item.id}>{edit.item({ id: c.item.id, kind: c.item.kind, as: c.as, rowClass: slotClass, index: placeOf.get(c.item.id) ?? -1, count: items.length })}</Fragment>
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
            // One list per page in practice; a second (an arranged page) gets its own heading id.
            const id = refsDrawn++ === 0 ? "refs-h" : `${row.items[0]!.item.id}-refs-h`;
            return (
              <section aria-labelledby={id} data-part="references" className={rc}>
                <ctx.Sub id={id} className="xp-label">
                  {FORMAT_COPY[f].refs ?? FORMAT_COPY[f].link}
                </ctx.Sub>
                <ul className="mt-1">
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
          case "before-after":
            return <div className={rc}>{row.items.map((c) => item(c, ""))}</div>;
        }
    }
  }

  return (
    <>
      {rows.map((row, r) => {
        const at = placeOf.get(firstItem(row).id) ?? 0;
        return (
          <Fragment key={firstItem(row).id}>
            {edit?.insert({ at })}
            {drawRow(row, r === 0)}
          </Fragment>
        );
      })}
      {edit?.insert({ at: items.length, end: true })}
    </>
  );
}

/** One page item, drawn the way `as` says. `rowClass` goes on its root (read-only page); the editor's frame leaves it out and carries those classes itself. */
export function ItemView({ item, as, ctx, rowClass = "" }: { item: PageItem; as: ItemAs; ctx: PageCtx; rowClass?: string }): React.ReactNode {
  if (item.kind === "flow") return <FlowPart steps={item.steps} as={as} rowClass={rowClass} ctx={ctx} />;
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
      break;
  }
  // "plain": the section on its own row, as SectionBlock draws it, with the row's classes.
  return <PlainSection s={s} Sub={Sub} imageUrls={imageUrls} format={f} rowClass={rowClass} ctx={ctx} at={at} />;
}
