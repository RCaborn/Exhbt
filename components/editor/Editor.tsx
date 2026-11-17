"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { deleteExhbt, publishExhbt, saveDraft, unpublishExhbt } from "@/app/(app)/exhbts/[id]/actions";
import { ProjectView, type Owner } from "@/components/portfolio/ProjectView";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { CopyLink } from "@/components/ui/CopyLink";
import type { Plan } from "@/lib/entitlements";
import { formatLimits, LIMITS, normaliseDoc, safeHref, validateForPublish, wordCount, type ExhbtDoc, type Picked } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, formatOf, type Format } from "@/lib/exhbt/formats";
import { hasData } from "@/lib/exhbt/charts";
import { newImageSection, roomFor } from "@/lib/exhbt/sections";
import { LayoutPicker } from "./LayoutPicker";
import { BlockTools, useDraftTools, type DraftToolsInit } from "./BlockTools";
import { ConfirmAction } from "./ConfirmAction";
import { FieldIssues } from "./FieldIssues";
import { FlowEditor } from "./FlowEditor";
import { Checklist, isBlank, stepsFor } from "./Checklist";
import { IMAGE_ACCEPT, WORK_ACCEPT, checkFile, fileIdsOf, prepareImage, readSize, removeFile, UploadError, uploadForExhbt } from "./media";
import { cardOf, cardWords, confirmNumber, issuesAt, labelOf, unverifiedOf, visibleIssues, type CardKey } from "./model";
import { Card, TextInput } from "./parts";
import { PreviewArrange } from "./PreviewArrange";
import { Sections } from "./Sections";
import { SkillsInput } from "./SkillsInput";
import { clearBackup, readBackup, useAutosave, type Backup } from "./useAutosave";

/** Tiptap loads in its own chunk, only here, and only in the browser (docs/phase-2.md section 6). */
const RichTextField = dynamic(() => import("./RichTextField").then((m) => m.RichTextField), {
  ssr: false,
  loading: () => <div aria-hidden className="field mt-[2.4rem] min-h-[2.9rem]" />,
});

export type EditorProps = {
  id: string;
  initialDoc: ExhbtDoc;
  status: "draft" | "published";
  slug: string | null;
  /** Where live exhbts are: https://alex.exhbt.co.uk, or /p/alex in development. Null with no username yet. */
  liveBase: string | null;
  owner: Owner;
  imageUrls: Record<string, string | null>;
  /** Signed URL for an attached file (links are read from the doc). */
  fileEvidenceUrl: string | null;
  /** Why the plan won't let this go live, if it won't (lib/plan-rules.ts canPublish). */
  planBlock: { reason: string; upgradeTo?: Plan } | null;
  /** When the server copy was last saved (ISO), to tell whether a backup kept in this browser is newer. */
  updatedAt: string;
  /** False on Free: exhbts can be built and previewed, not published. */
  canGoLive: boolean;
  /** The plan's cap for each uploaded file, in MB (ENTITLEMENTS[plan].uploadMbPerFile). */
  maxFileMb: number;
  /** Files the live (published) copy uses, so removing one from the draft doesn't break the live page before the next publish. */
  liveFileIds: string[];
  /** Links to the stored files that picked figures came from, by file id, for cropping again or choosing another page (decision 0017). */
  figureSources?: Record<string, string | null>;
  /** Rewrite and "Back to the AI version"; null or missing when the exhbt has no kept source text. */
  draftTools?: DraftToolsInit;
  /** The layout the AI draft chose, right after drafting (?drafted=gallery): a one-off line under the layout choice. */
  draftedAs?: Format;
};

/** Where the list at the top jumps to for an issue: the card's heading, or the "Add a section" button for the sections as a whole. */
const targetOf = (card: CardKey) => (card === "overall" ? "card-publish" : card === "sections" ? "add-section" : `card-${card}`);

/** Scrolls to a card and puts the cursor in its first field (or on the button itself, when the target is one). */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "start" });
  if (el instanceof HTMLButtonElement) return el.focus({ preventScroll: true });
  el.closest("section")?.querySelector<HTMLElement>("input:not([type=file]),textarea,[role=textbox],button")?.focus({ preventScroll: true });
}

const GUIDE_KEY = "exhbt-guide-hidden";

/**
 * The exhbt editor: one card per part of the fixed core (decision 0007, the "halfway"
 * approach), then the sections below the flowchart, which can be added, removed and reordered
 * (decision 0015, components/editor/Sections.tsx), with a live preview drawn by the real ProjectView. Saves as you go
 * (useAutosave: retries, a copy kept in this browser, a warning before leaving unsaved);
 * publishing runs the same checks again on the server.
 */
export function Editor(props: EditorProps) {
  const { id, status, slug, liveBase, owner, planBlock, canGoLive, maxFileMb } = props;
  const [doc, setDoc] = useState<ExhbtDoc>(props.initialDoc);
  const docRef = useRef(doc);
  docRef.current = doc;
  const f = formatOf(doc);
  const L = formatLimits(f);
  const copy = FORMAT_COPY[f];
  const [triedPublish, setTriedPublish] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [justLive, setJustLive] = useState<{ slug: string; changed: boolean } | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  // The preview's sections as a list to drag (PreviewArrange, decision 0022).
  const [arranging, setArranging] = useState(false);
  const [ready, setReady] = useState(false);
  const [offer, setOffer] = useState<Backup | null>(null);
  const [guided] = useState(() => isBlank(props.initialDoc));
  const [guideHidden, setGuideHidden] = useState(false);
  const [imageUrls, setImageUrls] = useState(props.imageUrls);
  const [workUrl, setWorkUrl] = useState<string | null>(props.fileEvidenceUrl);
  const [busy, setBusy] = useState<{ image?: boolean; work?: boolean }>({});
  const [mediaError, setMediaError] = useState<{ image?: string; work?: string }>({});
  const [imageStatus, setImageStatus] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const workInput = useRef<HTMLInputElement>(null);
  const problemsRef = useRef<HTMLDivElement>(null);
  // Files the live copy still uses, and files taken out of the draft that wait for a save before they're deleted.
  const live = useRef(new Set(props.liveFileIds));
  const drops = useRef(new Set<string>());

  const settleDrops = useCallback((saved: ExhbtDoc) => {
    const keep = new Set([...fileIdsOf(saved), ...live.current]);
    for (const f of [...drops.current]) {
      if (!keep.has(f)) {
        drops.current.delete(f);
        void removeFile(f);
      }
    }
  }, []);

  const autosave = useAutosave({
    id,
    doc,
    initial: props.initialDoc,
    save: (d) => saveDraft(id, d),
    onSavedDoc: settleDrops,
  });
  const save = autosave.status;

  useEffect(() => {
    setReady(true);
    try {
      setGuideHidden(window.localStorage.getItem(GUIDE_KEY) === "1");
    } catch {
      // Storage blocked: the checklist just shows.
    }
    // A copy kept in this browser that is newer than the server's: offer it back.
    const b = readBackup(id);
    if (b) {
      if (b.at > Date.parse(props.updatedAt) && JSON.stringify(b.doc) !== JSON.stringify(props.initialDoc)) setOffer(b);
      else clearBackup(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = useMemo(() => validateForPublish(doc), [doc]);
  const issues = useMemo(() => visibleIssues(doc, all, triedPublish), [doc, all, triedPublish]);
  const total = wordCount(doc);
  const cw = cardWords(doc);
  const flags = unverifiedOf(doc);
  const over = total > L.totalWords;
  // When the whole exhbt is over, the card with the most words is where to trim.
  const heaviest = over ? (Object.entries(cw).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as CardKey | undefined) : undefined;
  const flaggedBy = (card: CardKey) => issues.some((i) => cardOf(i.path) === card) || heaviest === card;

  const dt = useDraftTools(id, props.draftTools, doc, setDoc);
  const update = (patch: Partial<ExhbtDoc>) => setDoc((d) => ({ ...d, ...patch }));

  async function publish() {
    setTriedPublish(true);
    setPublishing(true);
    setResult(null);
    setJustLive(null);
    try {
      await autosave.settled();
      const r = await publishExhbt(id, doc, confirmed);
      if (r.ok) {
        autosave.markSaved(doc);
        // The live copy is now this doc: files only the old live copy used can go.
        for (const f of live.current) if (!fileIdsOf(doc).includes(f)) drops.current.add(f);
        live.current = new Set(fileIdsOf(doc));
        settleDrops(doc);
        setResult({ ok: true, lines: [] });
        setJustLive({ slug: r.slug, changed: status === "published" });
      } else {
        setResult({ ok: false, lines: r.reasons });
        setTimeout(() => problemsRef.current?.focus(), 0);
      }
    } catch {
      setResult({ ok: false, lines: ["Couldn't reach the server. Try again in a moment."] });
    } finally {
      setPublishing(false);
    }
  }

  /** Takes a file out of the draft; it is deleted once the save without it has landed. */
  function dropFile(fileId: string) {
    drops.current.add(fileId);
  }

  /**
   * Adds pictures, several at once (decision 0024). As many as the layout has room for, two at a
   * time: each is type-checked, shrunk in the browser (prepareImage), size-checked, uploaded, and
   * becomes an image section with its size. A failure says which file and why; the rest still go up.
   * Afterwards the cursor goes to the first empty description.
   */
  async function addImages(files: File[]) {
    if (!files.length) return;
    setMediaError((e) => ({ ...e, image: undefined }));
    setImageStatus("");
    const room = roomFor(docRef.current.sections, "image", formatOf(docRef.current));
    const take = files.slice(0, room);
    const problems: string[] = [];
    if (files.length > take.length) problems.push(room === 0 ? "There's no room for another image in this layout." : `Only ${room} more ${room === 1 ? "fits" : "fit"} in this layout. The rest weren't added.`);
    if (!take.length) {
      if (imageInput.current) imageInput.current.value = "";
      return setMediaError((e) => ({ ...e, image: problems.join(" ") }));
    }
    setBusy((b) => ({ ...b, image: true }));
    let done = 0;
    let added = 0;
    let next = 0;
    const worker = async () => {
      while (next < take.length) {
        const file = take[next++]!;
        setImageStatus(`Uploading ${Math.min(done + 1, take.length)} of ${take.length}`);
        try {
          const typeProblem = checkFile(file, "image", Infinity);
          if (typeProblem) throw new UploadError(typeProblem);
          const prepared = await prepareImage(file);
          const sizeProblem = checkFile(prepared.file, "image", maxFileMb);
          if (sizeProblem) throw new UploadError(sizeProblem);
          const fileId = await uploadForExhbt(prepared.file, "image", id);
          const size = prepared.w && prepared.h ? { w: prepared.w, h: prepared.h } : undefined;
          setImageUrls((u) => ({ ...u, [fileId]: URL.createObjectURL(prepared.file) }));
          setDoc((d) => (roomFor(d.sections, "image", formatOf(d)) === 0 ? d : { ...d, sections: [...d.sections, newImageSection(fileId, d.sections, size)] }));
          added++;
        } catch (e) {
          problems.push(`${file.name}: ${e instanceof UploadError ? e.message : "We couldn't upload that picture."}`);
        } finally {
          done++;
          setImageStatus(done < take.length ? `Uploading ${done + 1} of ${take.length}` : "");
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setBusy((b) => ({ ...b, image: false }));
    if (imageInput.current) imageInput.current.value = "";
    if (problems.length) setMediaError((m) => ({ ...m, image: problems.join("\n") }));
    if (added > 0) {
      setImageStatus(`${added === 1 ? "1 image" : `${added} images`} added. Each one needs a description for people who can't see it.`);
      // After the new cards are drawn: the cursor goes to the first empty description.
      setTimeout(() => {
        const imgs = docRef.current.sections.filter((s) => s.kind === "image");
        const n = imgs.findIndex((s) => s.kind === "image" && !s.alt.trim());
        if (n >= 0) document.getElementById(`image-${n}-alt`)?.focus();
      }, 120);
    }
  }

  async function attachWork(file: File | undefined) {
    if (!file) return;
    setMediaError((e) => ({ ...e, work: undefined }));
    const problem = checkFile(file, "evidence", maxFileMb);
    if (problem) return setMediaError((e) => ({ ...e, work: problem }));
    setBusy((b) => ({ ...b, work: true }));
    try {
      const fileId = await uploadForExhbt(file, "evidence", id);
      const old = doc.evidence?.kind === "file" ? doc.evidence.fileId : null;
      setWorkUrl(URL.createObjectURL(file));
      setDoc((d) => ({ ...d, evidence: { kind: "file", fileId, label: file.name } }));
      if (old) dropFile(old);
    } catch (e) {
      setMediaError((m) => ({ ...m, work: e instanceof UploadError ? e.message : "We couldn't upload that file." }));
    } finally {
      setBusy((b) => ({ ...b, work: false }));
      if (workInput.current) workInput.current.value = "";
    }
  }

  /**
   * A new picture for an image section, e.g. a picked figure cropped again or another page of its
   * report (decision 0017): uploaded first, then swapped in, and the old file dropped once the
   * save without it lands. Throws UploadError with a message to show.
   */
  async function replaceImage(sectionId: string, file: File, picked: Picked, opts: { describeAgain: boolean }) {
    const problem = checkFile(file, "image", maxFileMb);
    if (problem) throw new UploadError(problem);
    const old = doc.sections.find((s) => s.id === sectionId && s.kind === "image");
    const fileId = await uploadForExhbt(file, "image", id);
    const size = await readSize(file);
    setImageUrls((u) => ({ ...u, [fileId]: URL.createObjectURL(file) }));
    setDoc((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId && s.kind === "image" ? { ...s, fileId, picked, ...(size ?? {}), ...(opts.describeAgain ? { alt: "", caption: [] } : {}) } : s,
      ),
    }));
    if (old?.kind === "image" && old.fileId !== fileId) dropFile(old.fileId);
  }

  function removeWork() {
    if (doc.evidence?.kind === "file") dropFile(doc.evidence.fileId);
    setWorkUrl(null);
    update({ evidence: undefined });
  }

  const evidenceHref = doc.evidence?.kind === "link" ? safeHref(doc.evidence.href) : doc.evidence?.kind === "file" ? workUrl : null;
  // Graphs show in the preview once something is typed in them.
  const previewDoc: ExhbtDoc = { ...doc, title: doc.title.trim() || "Your question", sections: doc.sections.filter((s) => s.kind !== "graph" || hasData(s.chart)) };
  const liveUrl = liveBase && slug ? `${liveBase}/${slug}` : null;
  const arrangeable = f === "case-study" && doc.sections.length > 1;
  const justLiveUrl = liveBase && justLive ? `${liveBase}/${justLive.slug}` : null;
  const shownLive = canGoLive && status === "published";

  // What stops publishing, listed at the top once they've tried (and always the over-limit ones).
  const problems = [
    ...issues.map((i) => ({ message: labelOf(i.path, doc) ? `${labelOf(i.path, doc)}: ${i.message}` : i.message, target: targetOf(cardOf(i.path)) })),
    ...(triedPublish && result && !result.ok
      ? result.lines.filter((l) => !/^Fix /.test(l)).map((l) => ({ message: l, target: /flagged number/.test(l) ? "card-header" : "card-publish" }))
      : []),
  ];
  const summaryLines = result && !result.ok ? result.lines.filter((l) => /^Fix /.test(l)) : [];

  const steps = stepsFor(doc, shownLive || justLive !== null);
  const showGuide = guided && !guideHidden;
  const chip = !canGoLive ? "Preview only" : status === "published" ? "Live" : "Draft";

  return (
    <div className="editor-touch bg-mist" data-ready={ready || undefined} inert={!ready || undefined} onBlur={() => void autosave.flush()}>
      <div className="mx-auto max-w-[78rem] px-4 pt-8 pb-16 sm:px-8 xl:max-w-[90rem]">
        <Link href="/exhbts" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> Your exhbts
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h1 className="text-[2rem] sm:text-[2.5rem]">Edit exhbt</h1>
          <span className="chip">{chip}</span>
        </div>

        <div className="sticky top-0 z-20 -mx-4 mt-4 border-b border-line bg-mist/95 px-4 py-2 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="flex gap-2 lg:hidden">
              <Button size="sm" variant={view === "edit" ? "ink" : "secondary"} onClick={() => setView("edit")}>
                Edit
              </Button>
              <Button size="sm" variant={view === "preview" ? "ink" : "secondary"} onClick={() => setView("preview")}>
                Preview
              </Button>
            </div>
            <WordBar total={total} target={L.targetWords} limit={L.totalWords} />
            {problems.length > 0 && (
              <a
                href={`#${problems[0]!.target}`}
                onClick={(e) => {
                  e.preventDefault();
                  setView("edit");
                  jumpTo(problems[0]!.target);
                }}
                className="link font-semibold text-error"
              >
                {problems.length === 1 ? "1 thing to fix" : `${problems.length} things to fix`}
              </a>
            )}
            <span className="ml-auto">
              {save.state === "error" ? (
                <span className="inline-flex flex-wrap items-center gap-2 text-error">
                  <Button size="sm" variant="danger" onClick={() => void autosave.flush()} label="Not saved. Retry">
                    Not saved — retry
                  </Button>
                  <span className="text-graphite">Kept in this browser. {save.error}</span>
                </span>
              ) : (
                <span role="status" className="text-graphite">
                  {save.state === "saved" ? "Saved" : "Saving…"}
                </span>
              )}
            </span>
          </div>
        </div>

        {offer && (
          <div role="status" className="mt-4 rounded-[16px] border border-ink bg-surface p-4">
            <p className="font-semibold">
              We kept changes from {new Date(offer.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} that never reached the server.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  // Kept in this browser, maybe before sections: read into the current shape.
                  setDoc(normaliseDoc(offer.doc));
                  setOffer(null);
                }}
              >
                Restore them
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  clearBackup(id);
                  setOffer(null);
                }}
              >
                Discard them
              </Button>
            </div>
          </div>
        )}

        {triedPublish && problems.length > 0 && (
          <div ref={problemsRef} tabIndex={-1} role="region" aria-label="Things to fix before publishing" className="mt-4 rounded-[16px] border border-error bg-surface p-4">
            <p className="flex items-center gap-2 font-semibold text-error">
              <AlertTriangle aria-hidden size={18} strokeWidth={2.25} />
              {problems.length === 1 ? "1 thing to fix before this can go live" : `${problems.length} things to fix before this can go live`}
            </p>
            <ul className="mt-2 space-y-1">
              {problems.map((p, k) => (
                <li key={k}>
                  <a
                    href={`#${p.target}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setView("edit");
                      jumpTo(p.target);
                    }}
                    className="link text-error"
                  >
                    {p.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className={`min-w-0 space-y-5 ${view === "preview" ? "hidden lg:block" : ""}`}>
            {showGuide && (
              <Checklist
                steps={steps}
                onJump={jumpTo}
                onDismiss={() => {
                  setGuideHidden(true);
                  try {
                    window.localStorage.setItem(GUIDE_KEY, "1");
                  } catch {
                    // Hidden for this visit only.
                  }
                }}
              />
            )}
            <LayoutPicker doc={doc} setDoc={setDoc} draftedAs={props.draftedAs} />
            <Card id="card-header" title="Your question and details" words={cw.header} flagged={flaggedBy("header")} heaviest={heaviest === "header"}>
              {flags.length > 0 && (
                <ul aria-label="Numbers to check" className="mb-4 space-y-2">
                  {flags.map((n) => (
                    <li key={n} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-error bg-surface px-3 py-2">
                      <span>
                        Check this number: <strong className="font-mono">{n}</strong>
                        <span className="block text-sm text-graphite">We couldn&apos;t find it in your files. Fix it in the text, or confirm it.</span>
                      </span>
                      <Button size="sm" label={`That's right: ${n}`} onClick={() => setDoc((d) => confirmNumber(d, n))}>
                        That&apos;s right
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <BlockTools dt={dt} block="header" />
              <div className="space-y-4">
                <TextInput
                  id="title"
                  label={copy.title}
                  value={doc.title}
                  max={LIMITS.titleChars}
                  onChange={(title) => update({ title })}
                  issues={issuesAt(issues, "title")}
                  hint={f === "case-study" ? undefined : copy.titleHint}
                  placeholder={
                    f === "gallery"
                      ? "e.g. Freshers' Week campaign for the Law Society"
                      : f === "research"
                        ? "e.g. Does a 10-minute walk before a test improve recall?"
                        : "The question your work answers. e.g. Would a second till cut lunchtime queues?"
                  }
                />
                <TextInput
                  id="summary"
                  label="One-sentence summary"
                  value={doc.summary ?? ""}
                  onChange={(summary) => update({ summary })}
                  issues={issuesAt(issues, "summary")}
                  multiline
                  placeholder="What you found, in one sentence. Shown on your portfolio's cards."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput id="context" label="What it is" value={doc.context} max={LIMITS.contextChars} onChange={(context) => update({ context })} issues={issuesAt(issues, "context")} placeholder="e.g. MSc Finance dissertation" />
                  <TextInput
                    id="whereWhen"
                    label="Where and when"
                    value={doc.whereWhen ?? ""}
                    max={LIMITS.whereWhenChars}
                    onChange={(whereWhen) => update({ whereWhen })}
                    issues={issuesAt(issues, "whereWhen")}
                    placeholder="e.g. University of Leeds, May 2026"
                  />
                </div>
                <fieldset>
                  <legend className="label">
                    Headline number <span className="font-normal text-graphite">(optional, shown on job links)</span>
                  </legend>
                  <div className="grid grid-cols-[8rem_1fr] gap-2">
                    <input
                      aria-label="Headline number"
                      className="field font-mono"
                      value={doc.headline?.value ?? ""}
                      placeholder="−18%"
                      maxLength={12}
                      onChange={(e) => update({ headline: headline(e.target.value, doc.headline?.label ?? "") })}
                    />
                    <input
                      aria-label="What the number measures"
                      className="field"
                      value={doc.headline?.label ?? ""}
                      placeholder="missed appointments"
                      maxLength={40}
                      onChange={(e) => update({ headline: headline(doc.headline?.value ?? "", e.target.value) })}
                    />
                  </div>
                </fieldset>
                <SkillsInput skills={doc.skills} onChange={(skills) => update({ skills })} issues={issues} />
                <BlockTools dt={dt} block="skills" />
              </div>
            </Card>

            <Card
              id="card-gap"
              title={copy.gap}
              words={cw.gap}
              limit={L.gapWords}
              hint={f === "case-study" ? "Why the question matters, in one or two short sentences. Select the gap nobody has filled yet and press Highlight." : `${copy.gapHint} Select the words and press Highlight.`}
              flagged={flaggedBy("gap")}
              heaviest={heaviest === "gap"}
            >
              <BlockTools dt={dt} block="gap" />
              <RichTextField
                labelId="card-gap"
                describedBy="gap-issues"
                value={doc.gap}
                onChange={(gap) => update({ gap })}
                highlight
                placeholder={
                  f === "gallery"
                    ? "e.g. The Law Society asked for a Freshers' Week campaign to reach first-years who don't study law."
                    : f === "research"
                      ? "e.g. Exercise is known to lift mood. Whether a short walk helps recall straight after is less clear."
                      : "e.g. Lunchtime queues ran past ten minutes. Nobody had timed what a second till would save."
                }
              />
              <FieldIssues id="gap-issues" issues={issuesAt(issues, "gap")} />
            </Card>

            <Card id="card-flow" title={copy.flow} words={cw.flow} hint="How you did it, as a flowchart. Type in the boxes. Every exhbt has one." flagged={flaggedBy("flow")} heaviest={heaviest === "flow"}>
              <BlockTools dt={dt} block="flow" />
              <FlowEditor steps={doc.flow} onChange={(flow) => update({ flow })} issues={issues} />
              <FieldIssues id="flow-issues" issues={issuesAt(issues, "flow")} />
            </Card>

            <input ref={imageInput} type="file" hidden tabIndex={-1} aria-label="Choose an image" accept={IMAGE_ACCEPT} multiple onChange={(e) => void addImages(Array.from(e.target.files ?? []))} />
            <Sections
              doc={doc}
              setDoc={setDoc}
              issues={issues}
              words={cw}
              flaggedBy={flaggedBy}
              heaviest={heaviest}
              dt={dt}
              imageUrls={imageUrls}
              maxFileMb={maxFileMb}
              onAddImage={() => imageInput.current?.click()}
              imageBusy={Boolean(busy.image)}
              imageError={mediaError.image}
              imageStatus={imageStatus}
              dropFile={dropFile}
              figureSources={props.figureSources ?? {}}
              onReplaceImage={replaceImage}
            />

            <Card id="card-evidence" title="The work" words={cw.evidence} hint="One click to the original: a report, a repository, a dashboard. A link, or a file." flagged={flaggedBy("evidence")} heaviest={heaviest === "evidence"}>
              <input ref={workInput} type="file" hidden tabIndex={-1} aria-label="Choose a file" accept={WORK_ACCEPT} onChange={(e) => void attachWork(e.target.files?.[0])} />
              {doc.evidence?.kind === "file" ? (
                <div className="space-y-4">
                  <p>
                    File attached: <strong className="break-all">{doc.evidence.label}</strong>
                  </p>
                  <TextInput
                    id="evidence-label"
                    label="Name on the button"
                    value={doc.evidence.label}
                    placeholder="e.g. Final report (PDF)"
                    onChange={(label) => update({ evidence: { kind: "file", fileId: (doc.evidence as { fileId: string }).fileId, label } })}
                    issues={[]}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy.work} loading={busy.work} onClick={() => workInput.current?.click()} label="Replace the file">
                      {busy.work ? "Uploading…" : "Replace the file"}
                    </Button>
                    <Button size="sm" variant="danger" onClick={removeWork} label="Remove the file">
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <TextInput
                    id="evidence-href"
                    label="Link to the work"
                    type="url"
                    value={doc.evidence?.href ?? ""}
                    placeholder="https://"
                    onChange={(href) => update({ evidence: evidence(href, doc.evidence?.label ?? "") })}
                    issues={issuesAt(issues, "evidence")}
                  />
                  <TextInput
                    id="evidence-label"
                    label="Name on the button"
                    value={doc.evidence?.label ?? ""}
                    placeholder="e.g. Final report (PDF)"
                    onChange={(label) => update({ evidence: evidence(doc.evidence?.kind === "link" ? doc.evidence.href : "", label) })}
                    issues={[]}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" disabled={busy.work} loading={busy.work} onClick={() => workInput.current?.click()} label="Attach a file instead">
                      {busy.work ? "Uploading…" : "Attach a file instead"}
                    </Button>
                    <span className="hint">PDF, Word, PowerPoint, Excel, zip or text, up to {maxFileMb} MB.</span>
                  </div>
                </div>
              )}
              {mediaError.work && (
                <p role="alert" className="mt-2 text-sm text-error">
                  {mediaError.work}
                </p>
              )}
            </Card>

            <section aria-labelledby="card-publish" className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
              <h2 id="card-publish" className="scroll-mt-24 text-[1.375rem]">
                {!canGoLive ? "Publish" : status === "published" ? "Live" : "Publish"}
              </h2>
              {!canGoLive ? (
                <div className="mt-2 space-y-4">
                  <p className="text-graphite">This exhbt is a preview only: nobody else can see it.</p>
                  {planBlock && <UpgradePrompt reason={planBlock.reason} upgradeTo={planBlock.upgradeTo} />}
                </div>
              ) : (
                <>
                  {justLive && justLiveUrl ? (
                    <div role="status" className="mt-3 rounded-[16px] border border-ink bg-wash p-4">
                      <p className="text-[1.25rem] font-semibold">{justLive?.changed ? "Your changes are live." : "It's live."}</p>
                      <p className="mt-2 text-graphite">Paste this into an application:</p>
                      <p className="mt-1 font-mono text-sm break-words">
                        <a href={justLiveUrl} className="link font-semibold">
                          {justLiveUrl.replace(/^https:\/\//, "")}
                        </a>
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button href={justLiveUrl} variant="primary" label="View it">
                          View it
                        </Button>
                        <CopyLink href={justLiveUrl} />
                        <Button href="/exhbts">Back to your exhbts</Button>
                      </div>
                    </div>
                  ) : (
                    liveUrl &&
                    status === "published" && (
                      <p className="mt-2 break-words">
                        Live at{" "}
                        <a href={liveUrl} className="link font-semibold">
                          {liveUrl.replace(/^https:\/\//, "")}
                        </a>
                      </p>
                    )
                  )}
                  {planBlock && <UpgradePrompt reason={planBlock.reason} upgradeTo={planBlock.upgradeTo} primary={false} className="mt-3" />}
                  {!liveBase && (
                    <p className="mt-2 text-graphite">
                      You need a username to publish.{" "}
                      <Link href="/account/portfolio" className="link font-semibold text-ink">
                        Choose one
                      </Link>
                    </p>
                  )}
                  <FieldIssues id="overall-issues" issues={issuesAt(issues, "")} />
                  {all.length > 0 && (
                    <p className="mt-2 text-sm text-graphite">
                      {all.length === 1 ? "1 thing" : `${all.length} things`} to fix before this can go live.
                    </p>
                  )}
                  <label className="mt-4 flex items-start gap-3">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1.5 size-4 accent-jade" />
                    <span>This is my work, and the numbers are true</span>
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="primary" loading={publishing} disabled={publishing} onClick={publish} label={status === "published" ? "Publish changes" : "Publish"}>
                      {status === "published" ? "Publish changes" : "Publish"}
                    </Button>
                    {status === "published" && <ConfirmAction label="Unpublish" question="Take it off your portfolio?" confirmLabel="Yes, unpublish" action={() => unpublishExhbt(id)} />}
                  </div>
                  <div role="status" className="mt-3">
                    {summaryLines.length > 0 && (
                      <ul className="space-y-1 text-error">
                        {summaryLines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    )}
                    {result && !result.ok && problems.length === 0 && summaryLines.length === 0 && (
                      <ul className="space-y-1 text-error">
                        {result.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </section>

            <div className="flex justify-end pt-2">
              <ConfirmAction label="Delete this exhbt" variant="danger" question="Delete it for good?" confirmLabel="Yes, delete" action={() => deleteExhbt(id)} />
            </div>
          </div>

          <section
            aria-label="Preview"
            tabIndex={0}
            className={`min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)] lg:self-start lg:overflow-y-auto ${view === "edit" ? "hidden lg:block" : ""}`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-graphite">Preview</p>
              {arrangeable && (
                <Button size="sm" variant={arranging ? "ink" : "secondary"} aria-pressed={arranging} onClick={() => setArranging((a) => !a)} label={arranging ? "Done arranging" : "Arrange sections"}>
                  {arranging ? "Done arranging" : "Arrange sections"}
                </Button>
              )}
            </div>
            {/* The page as employers see it, on a white sheet (the editor's ground is mist). */}
            <div className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
              <ProjectView
                doc={previewDoc}
                owner={owner}
                imageUrls={imageUrls}
                evidenceUrl={evidenceHref}
                headingLevel="h2"
                confirmed={confirmed}
                sectionsSlot={arranging && arrangeable ? <PreviewArrange doc={doc} setDoc={setDoc} imageUrls={imageUrls} /> : undefined}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The total towards the target (150) and the limit (200): the figures and a bar. */
function WordBar({ total, target, limit }: { total: number; target: number; limit: number }) {
  const targetWords = target;
  const totalWords = limit;
  const over = total > totalWords;
  const pct = Math.min(100, (total / totalWords) * 100);
  return (
    <div className="flex min-w-[14rem] flex-1 items-center gap-3 sm:max-w-md" data-word-bar data-over={over || undefined}>
      <span className="font-mono text-graphite">
        <span className={over ? "font-semibold text-error" : "text-ink"}>{total}</span> words · aim for {targetWords}, at most {totalWords}
      </span>
      <span aria-hidden className="relative hidden h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-line sm:block">
        <span className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-error" : total > targetWords ? "bg-ink" : "bg-jade"}`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${(targetWords / totalWords) * 100}%` }} />
      </span>
    </div>
  );
}





const headline = (value: string, label: string) => (value.trim() || label.trim() ? { value, label } : undefined);
const evidence = (href: string, label: string): ExhbtDoc["evidence"] => (href.trim() || label.trim() ? { kind: "link", href: href.trim(), label } : undefined);

