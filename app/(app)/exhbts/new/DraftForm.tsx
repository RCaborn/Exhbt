"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Circle, FileText, Loader2, Upload, X } from "lucide-react";
import { DOC_ACCEPT, DocError, DocNeedsServer, countWords, extractTextInBrowser, readOnServer } from "@/lib/doc-readers";
import { removeFile } from "@/components/editor/media";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { finishUpload } from "@/components/team/finish-upload";
import { Button } from "@/components/ui/Button";
import type { Plan } from "@/lib/entitlements";
import { FORMAT_RULES, isFormat } from "@/lib/exhbt/formats";
import { isLayoutReason, type FigureNews } from "@/lib/exhbt/drafted";
import type { PdfPages } from "@/lib/figures/pdf";
import { Tick } from "@/components/ui/Tick";
import { drawPages, pdfCandidates, placeFigure, prepareFigure, withinCaps, type FigureOutcome, type FigureSource } from "./figure";

/**
 * The upload step: files are read on the device as they're added (scans and photos ask before
 * being sent to the AI reader), uploaded straight to Storage with a signed URL, then "Draft my
 * exhbt" sends the text, notes and link to /api/exhbts/draft and opens the editor.
 *
 * A PDF read on the device also has its first pages drawn small. While the draft is written, the
 * pages that draw a chart, diagram or table go to /api/exhbts/figure-pick; the figure picked is
 * cut out, uploaded and put on the exhbt before the editor opens, in place of the graph the draft
 * drew when it is a graph itself (decisions 0017 and 0025, ./figure.ts). A scan's pages are drawn
 * and sent only once the person has agreed to send the scan. The editor then says, once, which
 * layout was chosen and why, and what came of looking for a figure.
 */

/** How long, after the draft is saved, the page waits for the figure before opening the editor without it. */
const FIGURE_WAIT_MS = 20_000;
const isPdfFile = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

type Item = {
  key: string;
  file: File;
  /** reading → ready | consent (scan or photo) → transcribing → ready; or error. */
  status: "reading" | "consent" | "transcribing" | "ready" | "error";
  needs?: "scan" | "image";
  text: string;
  error?: string;
  upload: "uploading" | "done" | "failed" | "none";
  fileId?: string;
  /** A team project's file, already in this person's storage: taking it off the list doesn't delete it. */
  kept?: boolean;
};

/** A file from a team project to draft from (decision 0013), read in the browser like any other. */
export type PreloadFile = { fileId: string; name: string; mime: string; url: string };

/** What the drafting view says, and when (seconds after pressing the button) each step starts. The last stays until the answer arrives. */
const DRAFT_STEPS = [
  { label: "Reading your files", at: 0 },
  { label: "Finding the numbers", at: 6 },
  { label: "Writing your exhbt", at: 13 },
] as const;

const MB = 1024 * 1024;
/** Enough material to draft from; the server asks for the same. */
const MIN_WORDS = 20;
const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name);

/** Counts from the files being drafted from, waiting at most two seconds for the PDF pages that are still being drawn. */
async function uploadSignals(files: Item[], pages: Map<string, Promise<PdfPages | null>>) {
  const imageFiles = files.filter((it) => isImage(it.file)).length;
  let pdfPages = 0;
  let pdfPicturePages = 0;
  const deadline = new Promise<null>((r) => setTimeout(() => r(null), 2000));
  await Promise.all(
    files.map(async (it) => {
      const p = pages.get(it.key);
      const read = p ? await Promise.race([p.catch(() => null), deadline]) : null;
      if (!read) return;
      pdfPages += read.pageCount;
      // Every page of a scan is a picture of a page, which says nothing about how visual the work is.
      if (it.needs !== "scan") pdfPicturePages += read.pages.filter((pg) => pg.marks.pictures > 0).length;
    }),
  );
  return { imageFiles: Math.min(50, imageFiles), pdfPages: Math.min(5000, pdfPages), pdfPicturePages: Math.min(5000, pdfPicturePages) };
}
const sizeLabel = (b: number) => (b < MB ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / MB).toFixed(1)} MB`);

/**
 * `into`: a teammate's own exhbt to draft into instead of starting a new one, with `preload`,
 * the team project's files they were given.
 */
export function DraftForm({ maxFileMb, into, preload = [] }: { maxFileMb: number; into?: string; preload?: PreloadFile[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; limit?: boolean; upgradeTo?: Plan } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Drafting progress: which step is under way, and whether the answer has arrived (all done).
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  // Picking a figure from a PDF, beside the draft: not tried, under way, or finished (found or not).
  const [figure, setFigure] = useState<"none" | "working" | "done">("none");
  // Each PDF's pages, drawn once it has been read on the device (decision 0017).
  const pages = useRef(new Map<string, Promise<PdfPages | null>>());
  useEffect(() => {
    const drawn = pages.current;
    return () => drawn.forEach((p) => void p.then((x) => x?.pages.forEach((t) => URL.revokeObjectURL(t.url))));
  }, []);
  useEffect(() => {
    if (!busy) return;
    setStep(0);
    setDone(false);
    const timers = DRAFT_STEPS.slice(1).map((s, i) => setTimeout(() => setStep(i + 1), s.at * 1000));
    return () => timers.forEach(clearTimeout);
  }, [busy]);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  async function upload(key: string, file: File) {
    patch(key, { upload: "uploading" });
    try {
      const res = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, mime: file.type, bytes: file.size, kind: isImage(file) ? "image" : "source" }),
      });
      const data = (await res.json().catch(() => ({}))) as { fileId?: string; uploadUrl?: string; headers?: Record<string, string>; error?: string };
      if (!res.ok || !data.fileId || !data.uploadUrl) throw new DocError(data.error ?? "We couldn't upload that file.");
      const put = await fetch(data.uploadUrl, { method: "PUT", headers: data.headers, body: file });
      if (!put.ok) {
        await fetch(`/api/files/${data.fileId}`, { method: "DELETE" }).catch(() => undefined);
        throw new DocError("The upload didn't finish. Remove the file and try again.");
      }
      patch(key, { upload: "done", fileId: data.fileId });
      // Fingerprints the stored file; a match on someone else's exhbt raises the team prompt.
      void finishUpload(data.fileId, file.name);
    } catch (e) {
      patch(key, { upload: "failed", error: e instanceof DocError ? e.message : "We couldn't upload that file. Check your connection." });
    }
  }

  /** Reads a file on the device; then uploads it, unless it's already stored (a team file). */
  async function read(key: string, file: File, uploadAfter: boolean) {
    try {
      const text = await extractTextInBrowser(file);
      patch(key, { status: "ready", text });
      if (uploadAfter) void upload(key, file);
      // Read on the device, so its pages can be drawn here for picking a figure. A scan's are drawn only once the person agrees to send it (readOnServerFor).
      if (isPdfFile(file)) pages.current.set(key, drawPages(file));
    } catch (e) {
      if (e instanceof DocNeedsServer) {
        patch(key, { status: "consent", needs: e.kind });
        if (uploadAfter) void upload(key, file);
      } else {
        patch(key, { status: "error", error: e instanceof DocError ? e.message : "We couldn't read that file." });
      }
    }
  }

  async function add(files: FileList | File[] | null) {
    setError(null);
    for (const file of Array.from(files ?? [])) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      if (file.size > maxFileMb * MB) {
        setItems((l) => [...l, { key, file, status: "error", text: "", upload: "none", error: `Over the ${maxFileMb} MB limit for each file on your plan.` }]);
        continue;
      }
      setItems((l) => [...l, { key, file, status: "reading", text: "", upload: "none" }]);
      await read(key, file, true);
    }
  }

  // A team project's files: fetched from storage and read here, like a file just chosen.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const p of preload) {
        const key = `team-${p.fileId}`;
        let file: File;
        try {
          const res = await fetch(p.url);
          if (!res.ok) throw new Error(String(res.status));
          file = new File([await res.blob()], p.name, { type: p.mime });
        } catch {
          if (!cancelled) setItems((l) => [...l, { key, file: new File([], p.name), status: "error", text: "", upload: "none", kept: true, error: "We couldn't open this file. Reload the page to try again." }]);
          continue;
        }
        if (cancelled) return;
        setItems((l) => (l.some((x) => x.key === key) ? l : [...l, { key, file, status: "reading", text: "", upload: "done", fileId: p.fileId, kept: true }]));
        await read(key, file, false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  /** Lets a file's drawn pages go, so they can't be sent for a figure. */
  function forgetPages(key: string) {
    const drawn = pages.current.get(key);
    pages.current.delete(key);
    void drawn?.then((x) => x?.pages.forEach((t) => URL.revokeObjectURL(t.url)));
  }

  async function readOnServerFor(it: Item) {
    patch(it.key, { status: "transcribing", error: undefined });
    // They've agreed to send the scan, to be read and to be looked at for a figure (decision 0025).
    // Its pages are drawn here, on the device, and go with the draft like any other PDF's.
    if (it.needs === "scan" && !pages.current.has(it.key)) pages.current.set(it.key, drawPages(it.file));
    try {
      patch(it.key, { status: "ready", text: await readOnServer(it.file, "/api/files/transcribe") });
    } catch (e) {
      patch(it.key, { status: "consent", error: e instanceof DocError ? e.message : "We couldn't read that file." });
    }
  }

  async function remove(it: Item) {
    setItems((l) => l.filter((x) => x.key !== it.key));
    forgetPages(it.key);
    if (it.fileId && !it.kept) await fetch(`/api/files/${it.fileId}`, { method: "DELETE" }).catch(() => undefined);
  }

  const working = items.some((it) => it.status === "reading" || it.status === "transcribing" || it.upload === "uploading");
  const material = items.filter((it) => it.status === "ready" && it.text);
  const totalWords = material.reduce((n, it) => n + countWords(it.text), 0) + countWords(notes);
  const canDraft = ready && !working && !busy && totalWords >= MIN_WORDS;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canDraft) return;
    setBusy(true);
    setError(null);
    // The figure, picked beside the draft from the PDFs whose pages were drawn on this device
    // (decision 0017): those read here, and scans the person agreed to send (decision 0025).
    const stop = new AbortController();
    const drawn = material.filter((it) => pages.current.has(it.key));
    setFigure(drawn.length ? "working" : "none");
    // Whether some pages went unlooked-at, so "no figure" is never said of pages nobody saw: a PDF
    // longer than the pages drawn, pages past the caps on one pick, or a PDF that couldn't be drawn.
    let leftOut = false;
    const figureJob: Promise<FigureOutcome> | null = drawn.length
      ? (async (): Promise<FigureOutcome> => {
          const sources: FigureSource[] = [];
          for (const it of drawn) {
            const p = await pages.current.get(it.key);
            if (p) sources.push({ name: it.file.name, file: it.file, fileId: it.upload === "done" ? it.fileId : undefined, pages: p });
          }
          // A PDF whose pages couldn't be drawn wasn't looked at: that isn't "no figure".
          if (!sources.length) return { status: "failed" };
          const all = sources.flatMap(pdfCandidates);
          const candidates = withinCaps(all);
          leftOut = sources.length < drawn.length || candidates.length < all.length || sources.some((s) => s.pages.pageCount > s.pages.pages.length);
          return prepareFigure(candidates, stop.signal);
        })().catch((): FigureOutcome => ({ status: "failed" }))
      : null;
    // Counts from the upload for the AI's choice of layout (decision 0024): picture files, PDF pages, and
    // pages with pictures on them. Never the pages. Waits at most two seconds and sends what is known.
    const signals = await uploadSignals(items.filter((it) => it.status === "ready"), pages.current);
    let placed = false;
    // Whatever happens to the draft, a figure that was uploaded but never placed is deleted.
    const dropUnplaced = () => {
      stop.abort();
      void figureJob?.then((f) => {
        if (f.status === "ready" && !placed) void removeFile(f.figure.fileId);
      });
    };
    try {
      const res = await fetch("/api/exhbts/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: material.map((it) => `File: ${it.file.name}\n${it.text}`).join("\n\n"),
          notes,
          link: link.trim() || undefined,
          fileIds: items.filter((it) => it.upload === "done" && it.fileId).map((it) => it.fileId),
          signals,
          ...(into ? { into } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; upgradeTo?: Plan | null; format?: string; formatReason?: string };
      if (!res.ok || !data.id) {
        // A plan limit (403/429) gets the upgrade offer; anything else is a plain error.
        const limit = res.status === 403 || res.status === 429;
        setError({ message: data.error ?? "We couldn't draft your exhbt just now. Try again in a moment.", limit, upgradeTo: data.upgradeTo ?? undefined });
        dropUnplaced();
        setFigure("none");
        setBusy(false);
        return;
      }
      const format = isFormat(data.format) ? data.format : "case-study";
      // What the editor says about the figure when none goes on: none found, it couldn't look, or
      // there was no PDF to look in. A figure that does go on is read from the exhbt itself.
      let news: FigureNews | undefined;
      if (FORMAT_RULES[format].fromWork === "none") {
        // The layout takes nothing from the work (decision 0025): the pick is dropped below, nothing is placed, nothing is said.
      } else if (!figureJob) {
        const files = items.filter((it) => it.status === "ready");
        if (files.length && !files.some((it) => isPdfFile(it.file))) news = "unread";
      } else {
        // The figure goes on before the editor opens, so the editor's first save already has it.
        // A pick that takes longer than the wait is one that couldn't look, not one that found nothing.
        const late = new Promise<FigureOutcome>((r) => setTimeout(() => r({ status: "failed" }), FIGURE_WAIT_MS));
        const fig = await Promise.race([figureJob, late]);
        if (fig.status === "ready") {
          placed = await placeFigure(data.id, fig.figure);
          if (!placed) news = "failed";
        } else news = fig.status === "none" && leftOut ? "partial" : fig.status;
      }
      dropUnplaced();
      setFigure((f) => (f === "none" ? f : "done"));
      setDone(true);
      // The editor says, once, which layout was chosen and why, and what came of looking for a figure
      // (lib/exhbt/drafted.ts). It reads these and takes them off the address.
      const said = new URLSearchParams({ drafted: format });
      if (isLayoutReason(data.formatReason)) said.set("why", data.formatReason);
      if (news) said.set("fig", news);
      // A beat to see every step ticked, then the editor.
      setTimeout(() => router.push(`/exhbts/${data.id}/edit?${said.toString()}`), 600);
    } catch {
      dropUnplaced();
      setFigure("none");
      setError({ message: "We couldn't reach the server. Check your connection and try again." });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate data-ready={ready ? "true" : undefined} className="mt-8 space-y-6">
      {busy && <DraftingView step={step} done={done} words={totalWords} figure={figure} />}
      <div className={busy ? "hidden" : "space-y-6"}>
      <div>
        <label
          htmlFor="files"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void add(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed bg-mist px-6 py-10 text-center hover:border-jade has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-jade ${
            dragging ? "border-jade" : "border-field"
          }`}
        >
          <Upload aria-hidden size={26} strokeWidth={1.75} />
          <span className="text-[1.05rem] font-semibold">{items.length ? "Add more files" : "Choose or drop your project files"}</span>
          <span className="hint text-graphite">Reports, slides as PDF, Word, text, CSV or Excel, and photos. Up to {maxFileMb} MB each.</span>
          <input
            id="files"
            type="file"
            multiple
            accept={DOC_ACCEPT}
            className="sr-only"
            aria-describedby="file-list"
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        <ul id="file-list" aria-live="polite" className="mt-3 space-y-2">
          {items.map((it) => (
            <li key={it.key} className="rounded-[14px] border border-line px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <FileText aria-hidden size={15} className="shrink-0" />
                    <span className="truncate">{it.file.name}</span>
                    <span className="shrink-0 text-sm font-normal text-graphite">{sizeLabel(it.file.size)}</span>
                  </p>
                  <p className="mt-0.5 text-sm" data-testid="file-status">
                    {statusText(it)}
                  </p>
                  {it.error && <p className="mt-0.5 text-sm text-error">{it.error}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(it)}
                  aria-label={`Remove ${it.file.name}`}
                  className="shrink-0 rounded-full p-1.5 hover:bg-mist focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-jade"
                >
                  <X aria-hidden size={16} />
                </button>
              </div>

              {it.status === "consent" && (
                <div role="group" aria-label={`Read ${it.file.name}?`} className="mt-3 rounded-[12px] bg-mist p-4">
                  <p className="font-semibold">
                    {it.needs === "image" ? "That's a photo, so we can't read it on your device." : "That PDF looks like a scan, so we can't read it on your device."}
                  </p>
                  <p className="mt-1 text-sm text-graphite">
                    {it.needs === "image"
                      ? "We can send it to our AI reader to turn it into text. Only the text comes back, and the file stays private to you."
                      : "We can send it to our AI reader to turn it into text and to look for a figure, such as a graph, for your exhbt. Only the text and where the figure is come back, and the file stays private to you."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button variant="primary" size="sm" onClick={() => void readOnServerFor(it)}>
                      Read it for me
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Not sent to be read, so not looked at for a figure either.
                        forgetPages(it.key);
                        patch(it.key, { status: "ready", text: "" });
                      }}
                    >
                      {it.needs === "image" ? "Keep it as a picture" : "Keep it without reading"}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="notes" className="label">
          Notes <span className="font-normal text-graphite">(optional)</span>
        </label>
        <p id="notes-hint" className="hint mt-1">What was the question, what did you do, what came of it? We draft only from your files and these notes.</p>
        <textarea id="notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} aria-describedby="notes-hint" className="field mt-2" />
      </div>

      <div>
        <label htmlFor="link" className="label">
          Link to the work <span className="font-normal text-graphite">(optional)</span>
        </label>
        <p id="link-hint" className="hint mt-1">A GitHub repository or a published report, starting https://</p>
        <input
          id="link"
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-describedby="link-hint"
          placeholder="https://"
          className="field mt-2"
        />
      </div>

      {error?.limit && <UpgradePrompt reason={error.message} upgradeTo={error.upgradeTo} tone="alert" />}
      {error && !error.limit && (
        <div role="alert" className="rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
          <p>{error.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" label="Try again" disabled={!canDraft} onClick={() => void submit()}>
              Try again
            </Button>
            <span className="text-sm text-graphite">Your files and notes are still here. Nothing needs uploading again.</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-line pt-6">
        <p className="text-sm text-graphite" aria-live="polite">
          {working ? "Reading and uploading your files…" : `${totalWords.toLocaleString("en-GB")} words to draft from`}
        </p>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button type="submit" variant="primary" size="lg" label="Draft my exhbt" disabled={!canDraft}>
            Draft my exhbt <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
          </Button>
          {!canDraft && !working && totalWords < MIN_WORDS && (
            <p id="draft-hint" className="text-sm text-graphite">
              Add a file or a few sentences of notes to start.
            </p>
          )}
        </div>
      </div>
      </div>
    </form>
  );
}

function statusText(it: Item): React.ReactNode {
  if (it.status === "reading") return "Reading…";
  if (it.status === "transcribing") return "Reading it with the AI reader. Scans can take up to 30 seconds…";
  if (it.status === "consent") return "Not read yet";
  if (it.status === "error") return null;
  const words = countWords(it.text);
  const uploaded = it.kept ? " · from the team project" : it.upload === "uploading" ? " · uploading…" : it.upload === "done" ? " · uploaded" : "";
  return (
    <span className="inline-flex items-center gap-1.5">
      {words > 0 && (
        <Tick size="xs" />
      )}
      {words > 0 ? `${words.toLocaleString("en-GB")} words` : "Not read"}
      {uploaded}
    </span>
  );
}

/**
 * The wait, made calm (audit U1): three steps that advance on a timer and finish when the answer
 * arrives, with the usual time. The steps are a guide to what the draft does, not live progress.
 */
function DraftingView({ step, done, words, figure }: { step: number; done: boolean; words: number; figure: "none" | "working" | "done" }) {
  const current = done ? DRAFT_STEPS.length : step;
  type State = "done" | "active" | "waiting";
  const rows: { label: string; state: State; current: boolean }[] = DRAFT_STEPS.map((s, i) => ({
    label: s.label,
    state: i < current ? "done" : i === current ? "active" : "waiting",
    current: i === current,
  }));
  // Beside the draft, not after it: under way until the pick is in (decision 0017).
  if (figure !== "none") rows.push({ label: "Picking a figure from your report", state: figure === "done" ? "done" : "active", current: false });
  return (
    <section aria-labelledby="drafting-title" data-testid="drafting" className="rounded-[14px] bg-mist px-5 py-6">
      <h2 id="drafting-title" className="text-[1.375rem]">
        {done ? "Your exhbt is ready" : "Drafting your exhbt"}
      </h2>
      <p className="mt-1 text-graphite">
        Drafting from {words.toLocaleString("en-GB")} words. This usually takes about 20 seconds. Stay on this page.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-wash" role="progressbar" aria-label="Drafting your exhbt" aria-busy={!done}>
        <span className="block h-full w-1/3 rounded-full bg-jade motion-safe:animate-[indeterminate_1.6s_ease-in-out_infinite]" />
      </div>
      <ol className="mt-5 space-y-2">
        {rows.map(({ label, state, current: now }) => {
          return (
            <li key={label} data-state={state} aria-current={now && state === "active" ? "step" : undefined} className={`flex items-center gap-2.5 ${state === "waiting" ? "text-graphite" : "font-semibold"}`}>
              {state === "done" ? (
                <Tick />
              ) : state === "active" ? (
                <Loader2 aria-hidden size={20} className="motion-safe:animate-spin" />
              ) : (
                <Circle aria-hidden size={20} strokeWidth={1.5} />
              )}
              <span>
                {label}
                <span className="sr-only">{state === "done" ? ", done" : state === "active" ? ", under way" : ", waiting"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        {done ? "Done. Opening your exhbt." : `Step ${step + 1} of ${DRAFT_STEPS.length}: ${DRAFT_STEPS[step]!.label}`}
      </p>
    </section>
  );
}
