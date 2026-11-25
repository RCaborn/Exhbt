"use client";

import "../css/figures.css";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { PickedFigure } from "@/components/editor/PickedFigure";
import type { ExtraSlot } from "@/components/portfolio/page-ctx";
import type { Picked, SectionOf } from "@/lib/exhbt/blocks";
import { whereFrom } from "@/lib/figures/rules";
import { useEnv } from "../context";
import { InlineText } from "../fields/InlineText";
import { IssueNote, issueId, useFieldIssue } from "../fields/issues";
import { useFiles } from "../files";
import { useFrame } from "../Frame";
import { DESCRIPTION_PLACEHOLDER, descriptionClass, descriptionLabel } from "../geometry";
import { useDoc, useSection, useStore } from "../store";
import { useAnchoredPopover } from "./anchor";
import { opensPanel, Panel } from "./pop";

/*
 * An image's edit-only parts (decision 0026, "What the page does not draw"):
 *  - "below": the description, a field under the picture and its caption, in the flow, one of the
 *    two edit-only fields 0026 keeps there. It is the figure's last child (data-edit-only
 *    "image-description", the box-for-box tests allow it by that name), in its caption's type
 *    (descriptionClass, as the loading stand-in draws it, so nothing moves when the editor arrives),
 *    id image-N-alt with N its place among the images from 0. Until it has words it is marked
 *    "Needs a description", after its placeholder's last word, drawn over the page.
 *  - "above": for a figure picked from the person's report, a small label over the picture's top
 *    edge, "From your report, page 3", that opens the classic editor's PickedFigure strip in a native
 *    popover: where it came from, Crop, Choose another page and the tick. Until the tick is ticked the
 *    label holds it itself ("I may share this", after where it came from), so it is set on the page, where it is seen; the
 *    issue at sections.N.picked.shareOk is on that tick. Nothing here takes room.
 */
export function ImageExtras(props: ExtraSlot): ReactNode {
  if (props.where === "below") return <Description sectionId={props.sectionId} />;
  if (props.where === "above") return <PickedLabel sectionId={props.sectionId} />;
  return null;
}

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

function Description({ sectionId }: { sectionId: string }) {
  const frame = useFrame();
  const alt = useDoc((d) => {
    const s = d.sections.find((x) => x.id === sectionId);
    return s?.kind === "image" ? s.alt : "";
  });
  const n = useDoc((d) => d.sections.filter((x) => x.kind === "image").findIndex((x) => x.id === sectionId));
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === sectionId));
  return (
    <span data-edit-only="image-description" className={cx(descriptionClass(frame?.as), "relative")}>
      <InlineText path={`sections.${index}.alt`} value={alt} label={descriptionLabel(n + 1)} placeholder={DESCRIPTION_PLACEHOLDER} id={`image-${n}-alt`} />
      {!alt.trim() && <NeedsMark words={alt || DESCRIPTION_PLACEHOLDER} />}
    </span>
  );
}

/**
 * "Needs a description", just after the placeholder's last word: the placeholder's words again, unseen,
 * in the field's own type and width, with the mark after them, over the field (it takes no room and
 * lets every press through). Where the words would not fit on that last line (a narrow gallery tile,
 * whose rows are 12px apart) the mark is a dot there instead, its words kept for screen readers and
 * as its tooltip, so it never hangs under the figure into the next row. Where that line is full to its
 * end the dot has no room either: it then sits on the end of the line, over the top of its last letters.
 *
 * The mark starts from a point that takes no room on the line (`xe-fig-needs-at`), so the unseen words
 * break exactly as the field's do whatever follows them, and the mark is always on their last line.
 * When it took room, the page's `text-wrap: pretty` would not leave it alone on a line: it brought the
 * placeholder's last word down to it, a line under the field, and the two hung under the figure (in a
 * gallery's tile at about 900 wide on Chromium, and at 1440 on Safari, which breaks lines its own way).
 */
function NeedsMark({ words }: { words: string }) {
  const line = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;
    const fit = () => {
      const mark = el.querySelector(".xe-fig-needs")!;
      // The mark runs past the field's right edge (by more than the browser's own rounding).
      const over = () => mark.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.02;
      el.removeAttribute("data-compact");
      el.removeAttribute("data-tight");
      if (!over()) return;
      el.setAttribute("data-compact", "");
      if (over()) el.setAttribute("data-tight", "");
    };
    fit();
    const sized = new ResizeObserver(fit);
    sized.observe(el);
    return () => sized.disconnect();
  }, [words]);
  return (
    <span ref={line} className="xe-fig-needs-line" data-edit-only>
      <span aria-hidden className="xe-fig-needs-ghost">
        {words}
      </span>
      <span className="xe-fig-needs-at">
        <span className="xe-fig-needs" title="Needs a description">
          <span className="xe-fig-needs-words">Needs a description</span>
        </span>
      </span>
    </span>
  );
}

/**
 * In a narrow tile the label's words would wrap, and its two presses (the button and the tick) would
 * then sit on top of each other. So the label is measured: if the full words wrap, it shows the short
 * ones ("Page 3", "Share"; the full words stay for screen readers, as each control's name); if even
 * those wrap, the two stack as clear rows. Re-measured whenever the label or its tile changes size.
 */
function useNarrowLabel(ref: { current: HTMLSpanElement | null }, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wraps = () => {
      const open = el.querySelector(".xe-fig-picked-open");
      const tick = el.querySelector(".xe-fig-picked-tick");
      return Boolean(open && tick && tick.getBoundingClientRect().top >= open.getBoundingClientRect().bottom - 1);
    };
    const fit = () => {
      el.removeAttribute("data-compact");
      el.removeAttribute("data-stacked");
      if (!wraps()) return;
      el.setAttribute("data-compact", "");
      if (wraps()) el.setAttribute("data-stacked", "");
    };
    fit();
    const sized = new ResizeObserver(fit);
    sized.observe(el);
    if (el.parentElement) sized.observe(el.parentElement);
    return () => sized.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function PickedLabel({ sectionId }: { sectionId: string }) {
  const s = useSection(sectionId);
  if (s?.kind !== "image" || !s.picked) return null;
  return <PickedLabelOf s={s as SectionOf<"image"> & { picked: Picked }} />;
}

function PickedLabelOf({ s }: { s: SectionOf<"image"> & { picked: Picked } }) {
  const store = useStore();
  const env = useEnv();
  const files = useFiles();
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === s.id));
  const path = `sections.${index}`;
  const tickPath = `${path}.picked.shareOk`;
  const issue = useFieldIssue(tickPath);
  const id = useId();
  const tickId = `${id}-tick`;
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLElement>(null);
  useAnchoredPopover(button, pop);
  const p = s.picked;
  // The stored report it came from: linked when the page was opened, or one of the reports a figure can be taken from (a figure taken by hand this visit).
  const sourceId = p.sourceFileId;
  const sourceUrl = sourceId ? (env.figureSources?.[sourceId] ?? env.reportFiles.find((f) => f.fileId === sourceId)?.url ?? null) : null;
  const tick = (on: boolean) => store.patch(s.id, (x) => (x.kind === "image" && x.picked ? { ...x, picked: { ...x.picked, shareOk: on } } : x));
  const here = whereFrom(p);
  const where = `From your report, ${here}`;
  const label = useRef<HTMLSpanElement>(null);
  useNarrowLabel(label, [p.shareOk, here]);
  // The lead image's frame clips what overhangs it (it rounds the picture): there the label sits just inside its top edge.
  const inside = useFrame()?.as === "lead";
  return (
    <span ref={label} className="xe-fig-picked" data-edit-only data-inside={inside ? "" : undefined} data-ticked={p.shareOk ? "" : undefined} data-invalid={issue ? "" : undefined}>
      <button ref={button} type="button" className="xe-fig-picked-open" {...opensPanel(`${id}-pop`, () => pop.current)} aria-label={`${where}: crop it, choose another page, or say you may share it`}>
        <FileText aria-hidden size={13} strokeWidth={2.25} />
        <span className="xe-fig-long">{where}</span>
        <span aria-hidden className="xe-fig-short">
          {here.charAt(0).toUpperCase() + here.slice(1)}
        </span>
      </button>
      {!p.shareOk && (
        <>
          <label className="xe-fig-picked-tick" htmlFor={tickId}>
            <input
              id={tickId}
              type="checkbox"
              checked={false}
              onChange={(e) => {
                tick(e.target.checked);
                // Ticked, the tick leaves the label for the popover: the focus goes to the label's button, not to the page.
                requestAnimationFrame(() => button.current?.focus());
              }}
              data-path={tickPath}
              aria-label="I may share this figure on my portfolio"
              aria-invalid={issue ? true : undefined}
              aria-describedby={issue ? issueId(tickId) : undefined}
            />
            <span className="xe-fig-long">I may share this</span>
            <span aria-hidden className="xe-fig-short">
              Share
            </span>
          </label>
          <IssueNote id={issueId(tickId)} text={issue} />
        </>
      )}
      <Panel panelRef={pop} id={`${id}-pop`} className="xe-fig-pop-picked">
        <PickedFigure
          s={s}
          path={path}
          issues={issue ? [{ path: tickPath, message: issue }] : []}
          sourceUrl={sourceUrl}
          onTick={tick}
          onReplace={(file, picked, opts) => files.replaceImage(s.id, file, picked, opts)}
        />
      </Panel>
    </span>
  );
}
