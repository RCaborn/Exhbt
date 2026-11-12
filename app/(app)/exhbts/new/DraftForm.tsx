"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Circle, FileText, Loader2, Upload, X } from "lucide-react";
import { DOC_ACCEPT, DocError, DocNeedsServer, countWords, extractTextInBrowser, readOnServer } from "@/lib/doc-readers";
import { Button } from "@/components/ui/Button";

/**
 * The upload step: files are read on the device as they're added (scans and photos ask before
 * being sent to the AI reader), uploaded straight to Storage with a signed URL, then "Draft my
 * exhbt" sends the text, notes and link to /api/exhbts/draft and opens the editor.
 */

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
};

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
const sizeLabel = (b: number) => (b < MB ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / MB).toFixed(1)} MB`);

export function DraftForm({ maxFileMb }: { maxFileMb: number }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Drafting progress: which step is under way, and whether the answer has arrived (all done).
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
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
    } catch (e) {
      patch(key, { upload: "failed", error: e instanceof DocError ? e.message : "We couldn't upload that file. Check your connection." });
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
      try {
        const text = await extractTextInBrowser(file);
        patch(key, { status: "ready", text });
        void upload(key, file);
      } catch (e) {
        if (e instanceof DocNeedsServer) {
          patch(key, { status: "consent", needs: e.kind });
          void upload(key, file);
        } else {
          patch(key, { status: "error", error: e instanceof DocError ? e.message : "We couldn't read that file." });
        }
      }
    }
  }

  async function readOnServerFor(it: Item) {
    patch(it.key, { status: "transcribing", error: undefined });
    try {
      patch(it.key, { status: "ready", text: await readOnServer(it.file, "/api/files/transcribe") });
    } catch (e) {
      patch(it.key, { status: "consent", error: e instanceof DocError ? e.message : "We couldn't read that file." });
    }
  }

  async function remove(it: Item) {
    setItems((l) => l.filter((x) => x.key !== it.key));
    if (it.fileId) await fetch(`/api/files/${it.fileId}`, { method: "DELETE" }).catch(() => undefined);
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
    try {
      const res = await fetch("/api/exhbts/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: material.map((it) => `File: ${it.file.name}\n${it.text}`).join("\n\n"),
          notes,
          link: link.trim() || undefined,
          fileIds: items.filter((it) => it.upload === "done" && it.fileId).map((it) => it.fileId),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; upgrade?: boolean };
      if (!res.ok || !data.id) {
        setError({ message: data.error ?? "We couldn't draft your exhbt just now. Try again in a moment.", upgrade: data.upgrade });
        setBusy(false);
        return;
      }
      setDone(true);
      // A beat to see every step ticked, then the editor.
      setTimeout(() => router.push(`/exhbts/${data.id}/edit`), 600);
    } catch {
      setError({ message: "We couldn't reach the server. Check your connection and try again." });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate data-ready={ready ? "true" : undefined} className="mt-8 space-y-6">
      {busy && <DraftingView step={step} done={done} words={totalWords} />}
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
                    We can send it to our AI reader to turn it into text. Only the text comes back, and the file stays private to you.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button variant="primary" size="sm" onClick={() => void readOnServerFor(it)}>
                      Read it for me
                    </Button>
                    <Button size="sm" onClick={() => patch(it.key, { status: "ready", text: "" })}>
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

      {error && (
        <div role="alert" className="rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
          <p>
            {error.message}{" "}
            {error.upgrade && (
              <Link href="/pricing" className="link font-semibold">
                See plans
              </Link>
            )}
          </p>
          {!error.upgrade && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm" label="Try again" disabled={!canDraft} onClick={() => void submit()}>
                Try again
              </Button>
              <span className="text-sm text-graphite">Your files and notes are still here. Nothing needs uploading again.</span>
            </div>
          )}
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
  const uploaded = it.upload === "uploading" ? " · uploading…" : it.upload === "done" ? " · uploaded" : "";
  return (
    <span className="inline-flex items-center gap-1.5">
      {words > 0 && (
        <span className="inline-flex size-4 items-center justify-center rounded-full border border-ink bg-mint">
          <Check aria-hidden size={10} strokeWidth={3} />
        </span>
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
function DraftingView({ step, done, words }: { step: number; done: boolean; words: number }) {
  const current = done ? DRAFT_STEPS.length : step;
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
        {DRAFT_STEPS.map((s, i) => {
          const state = i < current ? "done" : i === current ? "active" : "waiting";
          return (
            <li key={s.label} data-state={state} aria-current={state === "active" ? "step" : undefined} className={`flex items-center gap-2.5 ${state === "waiting" ? "text-graphite" : "font-semibold"}`}>
              {state === "done" ? (
                <span className="inline-flex size-5 items-center justify-center rounded-full border border-ink bg-mint">
                  <Check aria-hidden size={12} strokeWidth={3} />
                </span>
              ) : state === "active" ? (
                <Loader2 aria-hidden size={20} className="motion-safe:animate-spin" />
              ) : (
                <Circle aria-hidden size={20} strokeWidth={1.5} />
              )}
              <span>
                {s.label}
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
