"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { HomeLinesSlot } from "@/components/portfolio/home-ctx";
import { joinYear, splitYear } from "@/lib/portfolio-layout";
import { usePortfolioApi, useRuntime } from "../runtime";
import { addLine, moveLine, removeLine } from "../sections/arrange";
import { ToolRow } from "../sections/ToolRow";
import { W } from "../sections/words";

/*
 * The controls over a list of education or experience lines (brief F, step 10), drawn over the list's
 * bottom edge and taking no room: "Add a line" while the plan's limit leaves room (`max`, from
 * TILE_LIMITS), and, for the line the cursor or the pointer is in, Move up, Move down and Remove. That
 * line takes an outline in the look's link colour, so the controls say which line they move. One
 * toolbar: one Tab stop, the arrow keys along it.
 *
 * It is the last child of the lines' <dl> (d-findings.md), absolute, without the rows' hairline, and it
 * carries the list's own `data-path`, where the list's own problem shows and "Show me" lands.
 *
 * When a line's year holds words that `splitYear` will not read as a year, a hint shows under that
 * field while it has the cursor.
 */

/** The line a field belongs to: its index in the stored list, from its path. */
const indexIn = (path: string, el: Element | null): number | null => {
  const at = el?.closest("[data-path]")?.getAttribute("data-path") ?? "";
  if (!at.startsWith(`${path}.`)) return null;
  const n = Number(at.slice(path.length + 1));
  return Number.isInteger(n) ? n : null;
};

const yearReads = (year: string) => !year.trim() || splitYear(joinYear("x", year)).year !== null;

export function LineTools({ path, kind, count, max }: HomeLinesSlot): ReactNode {
  const api = usePortfolioApi();
  const rt = useRuntime();
  const own = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [hint, setHint] = useState<HTMLElement | null>(null);
  const hintRef = useRef<HTMLElement | null>(null);
  hintRef.current = hint;

  // Which line the controls are for: the one with the cursor, else the one under the pointer.
  useEffect(() => {
    const dl = own.current?.parentElement;
    if (!dl) return;
    const rowOf = (i: number | null) => (i == null ? null : (dl.querySelector(`[data-path="${CSS.escape(`${path}.${i}`)}"]`)?.closest("dl > div") ?? null));
    let focused: number | null = null;
    let hovered: number | null = null;
    const mark = () => {
      const i = focused ?? hovered;
      for (const r of dl.querySelectorAll(":scope > div[data-pe-line]")) r.removeAttribute("data-pe-line");
      rowOf(i)?.setAttribute("data-pe-line", "active");
      setActive(i);
    };
    const checkYear = (el: Element | null) => {
      const field = el instanceof HTMLTextAreaElement && el.closest("[data-part=year]") ? el : null;
      setHint(field && !yearReads(field.value) ? field : null);
    };
    const onFocusIn = (e: FocusEvent) => {
      const i = indexIn(path, e.target as Element);
      // A press on the controls keeps the line they are for.
      if (i != null || !own.current?.contains(e.target as Node)) focused = i;
      checkYear(e.target as Element);
      mark();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!dl.contains(e.relatedTarget as Node)) {
        focused = null;
        setHint(null);
        mark();
      }
    };
    const onInput = (e: Event) => checkYear(e.target as Element);
    const onOver = (e: MouseEvent) => {
      if (own.current?.contains(e.target as Node)) return;
      hovered = indexIn(path, (e.target as Element).closest("dl > div")?.querySelector("[data-path]") ?? null);
      mark();
    };
    const onLeave = () => {
      hovered = null;
      mark();
    };
    dl.addEventListener("focusin", onFocusIn);
    dl.addEventListener("focusout", onFocusOut);
    dl.addEventListener("input", onInput);
    dl.addEventListener("mouseover", onOver);
    dl.addEventListener("mouseleave", onLeave);
    return () => {
      dl.removeEventListener("focusin", onFocusIn);
      dl.removeEventListener("focusout", onFocusOut);
      dl.removeEventListener("input", onInput);
      dl.removeEventListener("mouseover", onOver);
      dl.removeEventListener("mouseleave", onLeave);
    };
  }, [path, count]);

  const n = active != null && active < count ? active : null;
  const focusLine = (i: number, act: string) =>
    requestAnimationFrame(() => {
      const btn = own.current?.querySelector<HTMLElement>(`[data-act="${act}"]`);
      if (btn && btn.getAttribute("aria-disabled") !== "true") return btn.focus();
      own.current?.parentElement?.querySelector<HTMLElement>(`[data-part=label] [data-path="${CSS.escape(`${path}.${i}`)}"]`)?.focus();
    });

  const add = () => {
    api.change((s) => addLine(s, kind, max), W.addedLine(kind));
    api.jumpTo(`${path}.${count}`);
  };
  const move = (by: -1 | 1) => {
    if (n == null) return;
    api.change((s) => moveLine(s, kind, n, n + by), W.movedLine(n + 1));
    setActive(n + by);
    focusLine(n + by, by < 0 ? "line-up" : "line-down");
  };
  const remove = () => {
    if (n == null) return;
    api.change((s) => removeLine(s, kind, n), W.removedLine(n + 1));
    const left = rt.state.get().arrangement.tiles[kind]?.lines.length ?? 0;
    setActive(left ? Math.min(n, left - 1) : null);
    if (left) focusLine(Math.min(n, left - 1), "line-remove");
    else requestAnimationFrame(() => own.current?.querySelector<HTMLElement>('[data-act="add-line"]')?.focus());
  };

  return (
    <div ref={own} className="pe-line-tools" data-path={path} data-pe-lines={kind} data-active={n ?? undefined}>
      <ToolRow spot={{ x: 0, y: 0, where: "edge" }} kind="line" label={W.lineTools(kind, (n ?? 0) + 1)}>
        {count < max && (
          <Button size="sm" label={W.addLine(kind)} onClick={add} {...({ "data-act": "add-line" } as object)}>
            <Plus aria-hidden size={15} strokeWidth={2.5} /> {W.addLine(kind)}
          </Button>
        )}
        {n != null && (
          <>
            <IconButton data-act="line-up" variant="ghost" label={W.lineUp(n + 1)} tooltip={W.lineUp(n + 1)} isDisabled={n === 0} onClick={() => move(-1)} icon={<ArrowUp aria-hidden size={16} strokeWidth={2} />} />
            <IconButton data-act="line-down" variant="ghost" label={W.lineDown(n + 1)} tooltip={W.lineDown(n + 1)} isDisabled={n >= count - 1} onClick={() => move(1)} icon={<ArrowDown aria-hidden size={16} strokeWidth={2} />} />
            <IconButton data-act="line-remove" variant="ghost" label={W.lineRemove(n + 1)} tooltip={W.lineRemove(n + 1)} onClick={remove} icon={<X aria-hidden size={16} strokeWidth={2.25} />} />
          </>
        )}
      </ToolRow>
      {hint && <Tooltip key={hint.id || "hint"} anchorRef={hintRef} content={W.yearHint} isOpen placement="below" alignment="end" />}
    </div>
  );
}
