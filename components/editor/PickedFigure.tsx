"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FigureBox, Issue, Picked, SectionOf } from "@/lib/exhbt/blocks";
import type { PdfPages } from "@/lib/figures/pdf";
import { FIGURE, clampBox, whereFrom } from "@/lib/figures/rules";
import { FieldIssues } from "./FieldIssues";
import { UploadError } from "./media";
import { issuesAt } from "./model";

/**
 * A figure Exhbt picked from the person's upload (decision 0017), in its image card: the note
 * that it came from their report and may not be theirs to share, the tick that lets it be
 * published, and two ways to change it without another AI call: crop it again, or choose another
 * page of the same PDF. Both draw the page here from the stored file, cut the new picture out and
 * upload it in place of the old one. Removing it is the card's own Remove button.
 */

/** A new picture for the section, and the note of where it now comes from. */
export type ReplaceFigure = (file: File, picked: Picked, opts: { describeAgain: boolean }) => Promise<void>;

/** The stored PDF's bytes, fetched once per file while the editor is open. */
const sources = new Map<string, Promise<Uint8Array>>();
function sourceBytes(fileId: string, url: string): Promise<Uint8Array> {
  let p = sources.get(fileId);
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      return new Uint8Array(await r.arrayBuffer());
    });
    p.catch(() => sources.delete(fileId));
    sources.set(fileId, p);
  }
  return p;
}

/** Thumbnails for the page picker, drawn once per file. */
const thumbs = new Map<string, Promise<PdfPages>>();
function pageThumbs(fileId: string, url: string): Promise<PdfPages> {
  let p = thumbs.get(fileId);
  if (!p) {
    p = sourceBytes(fileId, url).then(async (bytes) => (await import("@/lib/figures/pdf")).pdfPages(bytes, { edge: 360 }));
    p.catch(() => thumbs.delete(fileId));
    thumbs.set(fileId, p);
  }
  return p;
}

const stem = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 60) || "report";
const asFile = (blob: Blob, name: string, page: number) => new File([blob], `${stem(name)}-page-${page}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type });

export function PickedFigure({
  s,
  path,
  issues,
  sourceUrl,
  onTick,
  onReplace,
}: {
  s: SectionOf<"image"> & { picked: Picked };
  /** The section's issue path, "sections.2". */
  path: string;
  issues: Issue[];
  /** A link to the stored PDF it came from; null when it isn't stored (then it can't be cropped again or swapped). */
  sourceUrl: string | null;
  onTick: (shareOk: boolean) => void;
  onReplace: ReplaceFigure;
}) {
  const id = useId();
  const p = s.picked;
  const [panel, setPanel] = useState<"crop" | "pages" | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canChange = Boolean(p.page && p.sourceFileId && sourceUrl);

  async function replace(make: (bytes: Uint8Array) => Promise<{ file: File; picked: Picked; describeAgain: boolean }>, done: string) {
    if (!p.sourceFileId || !sourceUrl) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const next = await make(await sourceBytes(p.sourceFileId, sourceUrl));
      await onReplace(next.file, next.picked, { describeAgain: next.describeAgain });
      setPanel(null);
      setStatus(done);
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "We couldn't change the image just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const crop = (box: FigureBox) =>
    replace(async (bytes) => {
      const { pdfFigure } = await import("@/lib/figures/pdf");
      const blob = await pdfFigure(bytes, p.page!, box, { margin: false });
      return { file: asFile(blob, p.from, p.page!), picked: { ...p, box }, describeAgain: false };
    }, "Cropped.");

  const swap = (page: number) =>
    replace(async (bytes) => {
      const { pdfFigure } = await import("@/lib/figures/pdf");
      const blob = await pdfFigure(bytes, page, null);
      // Another page is another figure: the tick, the description and the caption start again.
      return { file: asFile(blob, p.from, page), picked: { ...p, page, box: { x: 0, y: 0, w: 1, h: 1 }, shareOk: false }, describeAgain: true };
    }, `Page ${page} is in. Crop it to the figure, then describe it.`);

  return (
    <div role="group" aria-labelledby={`${id}-title`} data-picked className="rounded-[12px] border border-line bg-wash p-4">
      <p id={`${id}-title`} className="font-semibold">
        Picked from your report. Check you&apos;re allowed to share it.
      </p>
      <p className="mt-1 text-sm text-graphite">
        From {p.from}, {whereFrom(p)}. A figure your supervisor, a client or a company made may not be yours to put online.
        {canChange ? " Crop it, choose another page, or remove the image." : " Remove the image if it isn't."}
      </p>
      <label className="mt-3 flex items-start gap-2.5 font-semibold">
        <input
          type="checkbox"
          checked={p.shareOk}
          onChange={(e) => onTick(e.target.checked)}
          aria-describedby={`${id}-issues`}
          className="mt-1 size-4 shrink-0 accent-jade"
        />
        I may share this figure on my portfolio
      </label>
      <FieldIssues id={`${id}-issues`} issues={issuesAt(issues, `${path}.picked.shareOk`)} />

      {canChange && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant={panel === "crop" ? "ink" : "secondary"} aria-expanded={panel === "crop"} disabled={busy} onClick={() => setPanel(panel === "crop" ? null : "crop")}>
            Crop
          </Button>
          <Button size="sm" variant={panel === "pages" ? "ink" : "secondary"} aria-expanded={panel === "pages"} disabled={busy} onClick={() => setPanel(panel === "pages" ? null : "pages")}>
            Choose another page
          </Button>
        </div>
      )}
      {canChange && panel === "pages" && <PagePicker fileId={p.sourceFileId!} url={sourceUrl!} name={p.from} current={p.page!} busy={busy} onPick={(n) => void swap(n)} />}
      {canChange && panel === "crop" && (
        <Cropper fileId={p.sourceFileId!} url={sourceUrl!} name={p.from} page={p.page!} box={p.box} busy={busy} onCrop={(b) => void crop(b)} onCancel={() => setPanel(null)} />
      )}
      <p role="status" className="mt-2 text-sm text-graphite empty:hidden">
        {busy ? "Updating the image…" : status}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** The PDF's first pages as small buttons: a click puts that page in instead. */
function PagePicker({ fileId, url, name, current, busy, onPick }: { fileId: string; url: string; name: string; current: number; busy: boolean; onPick: (page: number) => void }) {
  const [pages, setPages] = useState<PdfPages | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    pageThumbs(fileId, url).then(
      (p) => live && setPages(p),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [fileId, url]);

  if (failed) return <p className="mt-3 text-sm text-error">We couldn&apos;t open {name}. Reload the page to try again.</p>;
  if (!pages) return <p className="mt-3 text-sm text-graphite" role="status">Opening {name}…</p>;
  return (
    <div className="mt-3" data-testid="page-picker">
      <p className="text-sm text-graphite">
        Choose the page with the figure.{pages.pageCount > pages.pages.length ? ` Showing the first ${pages.pages.length} of ${pages.pageCount} pages.` : ""}
      </p>
      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={`Pages of ${name}`}>
        {pages.pages.map((t) => {
          const on = t.page === current;
          return (
            <li key={t.page}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Page ${t.page}${on ? ", in use now" : ""}`}
                disabled={busy}
                onClick={() => !on && onPick(t.page)}
                className={`block w-full rounded-[10px] border-2 bg-surface p-1 text-center text-xs text-graphite hover:border-ink disabled:opacity-60 ${on ? "border-jade" : "border-line"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a page drawn in this browser, as an object URL */}
                <img src={t.url} alt="" width={t.width} height={t.height} className="h-auto w-full rounded-[6px]" />
                <span className="mt-1 block">Page {t.page}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Edge = "left" | "top" | "right" | "bottom";
const EDGES: { key: Edge; label: string }[] = [
  { key: "left", label: "Left edge" },
  { key: "right", label: "Right edge" },
  { key: "top", label: "Top edge" },
  { key: "bottom", label: "Bottom edge" },
];
const pct = (n: number) => Math.round(n * 1000) / 10;

/**
 * The page with the crop drawn on it. Drag across the page to draw a new box, or set each edge
 * with its slider (the keyboard's way). "Use this crop" cuts the box out at full resolution.
 */
function Cropper({
  fileId,
  url,
  name,
  page,
  box,
  busy,
  onCrop,
  onCancel,
}: {
  fileId: string;
  url: string;
  name: string;
  page: number;
  box?: FigureBox;
  busy: boolean;
  onCrop: (b: FigureBox) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [img, setImg] = useState<{ url: string; width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const start = clampBox(box);
  const [e, setE] = useState({ left: start.x, top: start.y, right: start.x + start.w, bottom: start.y + start.h });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    sourceBytes(fileId, url)
      .then(async (bytes) => (await import("@/lib/figures/pdf")).pdfFigure(bytes, page, null, { edge: 1000 }))
      .then((blob) => {
        made = URL.createObjectURL(blob);
        const probe = new Image();
        probe.onload = () => live && setImg({ url: made!, width: probe.naturalWidth, height: probe.naturalHeight });
        probe.src = made;
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [fileId, url, page]);

  const min = FIGURE.minSide;
  function setEdge(k: Edge, v: number) {
    setE((cur) => {
      const n = Math.min(1, Math.max(0, v));
      if (k === "left") return { ...cur, left: Math.min(n, cur.right - min) };
      if (k === "right") return { ...cur, right: Math.max(n, cur.left + min) };
      if (k === "top") return { ...cur, top: Math.min(n, cur.bottom - min) };
      return { ...cur, bottom: Math.max(n, cur.top + min) };
    });
  }

  const at = (ev: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
  };

  if (failed) return <p className="mt-3 text-sm text-error">We couldn&apos;t open {name}. Reload the page to try again.</p>;
  if (!img) return <p className="mt-3 text-sm text-graphite" role="status">Opening page {page}…</p>;

  const b: FigureBox = { x: e.left, y: e.top, w: e.right - e.left, h: e.bottom - e.top };
  return (
    <div className="mt-3" data-testid="cropper">
      <p id={`${id}-how`} className="text-sm text-graphite">
        Drag across the page to draw the box round the figure, or move each edge with its slider.
      </p>
      <div
        ref={frame}
        className="relative mt-2 max-w-[26rem] touch-none select-none overflow-hidden rounded-[8px] border border-line bg-surface"
        onPointerDown={(ev) => {
          if (busy) return;
          frame.current!.setPointerCapture(ev.pointerId);
          drag.current = at(ev);
        }}
        onPointerMove={(ev) => {
          if (!drag.current) return;
          const p = at(ev);
          const s = drag.current;
          if (Math.abs(p.x - s.x) < min || Math.abs(p.y - s.y) < min) return;
          setE({ left: Math.min(s.x, p.x), right: Math.max(s.x, p.x), top: Math.min(s.y, p.y), bottom: Math.max(s.y, p.y) });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a page drawn in this browser, as an object URL */}
        <img src={img.url} alt={`Page ${page} of ${name}`} width={img.width} height={img.height} draggable={false} className="block h-auto w-full" />
        <div
          aria-hidden
          data-crop-box
          className="pointer-events-none absolute border-2 border-jade"
          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, boxShadow: "0 0 0 9999px rgb(14 15 18 / 0.45)" }}
        />
      </div>
      <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {EDGES.map(({ key, label }) => (
          <label key={key} className="text-sm">
            <span className="flex justify-between">
              <span className="font-semibold">{label}</span>
              <span className="font-mono text-graphite">{pct(e[key])}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={pct(e[key])}
              aria-describedby={`${id}-how`}
              onChange={(ev) => setEdge(key, Number(ev.target.value) / 100)}
              className="w-full accent-jade"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ink" disabled={busy} loading={busy} onClick={() => onCrop(b)}>
          Use this crop
        </Button>
        <Button size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
