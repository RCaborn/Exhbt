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
 * as its tooltip, so it never hangs under the figure into the next row.
 */
function NeedsMark({ words }: { words: string }) {
  const line = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;
    const fit = () => {
      const ghost = el.firstElementChild!;
      const mark = el.lastElementChild!;
      el.removeAttribute("data-compact");
      const lines = ghost.getClientRects();
      const last = lines[lines.length - 1];
      if (last && mark.getBoundingClientRect().top >= last.bottom - 1) el.setAttribute("data-compact", "");
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
      <span className="xe-fig-needs" title="Needs a description">
        <span className="xe-fig-needs-words">Needs a description</span>
      </span>
    </span>
  );
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
  const pop = useRef<HTMLDivElement>(null);
  useAnchoredPopover(button, pop);
  const p = s.picked;
  // The stored report it came from: linked when the page was opened, or one of the reports a figure can be taken from (a figure taken by hand this visit).
  const sourceId = p.sourceFileId;
  const sourceUrl = sourceId ? (env.figureSources?.[sourceId] ?? env.reportFiles.find((f) => f.fileId === sourceId)?.url ?? null) : null;
  const tick = (on: boolean) => store.patch(s.id, (x) => (x.kind === "image" && x.picked ? { ...x, picked: { ...x.picked, shareOk: on } } : x));
  const where = `From your report, ${whereFrom(p)}`;
  return (
    <span className="xe-fig-picked" data-edit-only data-ticked={p.shareOk ? "" : undefined} data-invalid={issue ? "" : undefined}>
      <button ref={button} type="button" className="xe-fig-picked-open" popoverTarget={`${id}-pop`} aria-label={`${where}: crop it, choose another page, or say you may share it`}>
        <FileText aria-hidden size={13} strokeWidth={2.25} />
        {where}
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
            I may share this
          </label>
          <IssueNote id={issueId(tickId)} text={issue} />
        </>
      )}
      <div ref={pop} id={`${id}-pop`} popover="auto" className="xe-fig-pop xe-fig-pop-picked">
        <PickedFigure
          s={s}
          path={path}
          issues={issue ? [{ path: tickPath, message: issue }] : []}
          sourceUrl={sourceUrl}
          onTick={tick}
          onReplace={(file, picked, opts) => files.replaceImage(s.id, file, picked, opts)}
        />
      </div>
    </span>
  );
}
