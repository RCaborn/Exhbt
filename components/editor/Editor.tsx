"use client";

/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see components/portfolio/Avatar.tsx. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ImageIcon, Plus, X } from "lucide-react";
import { deleteExhbt, publishExhbt, saveDraft, unpublishExhbt } from "@/app/(app)/exhbts/[id]/actions";
import { TrustPreview } from "@/components/exhbt/TrustBadge";
import { ProjectView, type Owner } from "@/components/portfolio/ProjectView";
import { Button } from "@/components/ui/Button";
import { CopyLink } from "@/components/ui/CopyLink";
import { LIMITS, plain, safeHref, validateForPublish, wordCount, words, type ExhbtDoc, type Issue } from "@/lib/exhbt/blocks";
import { ChartEditor, newChart } from "./ChartEditor";
import { ConfirmAction } from "./ConfirmAction";
import { FieldIssues } from "./FieldIssues";
import { FlowEditor } from "./FlowEditor";
import { Checklist, isBlank, stepsFor } from "./Checklist";
import { IMAGE_ACCEPT, WORK_ACCEPT, checkFile, fileIdsOf, removeFile, UploadError, uploadForExhbt } from "./media";
import { cardOf, cardWords, confirmNumber, issuesAt, unverifiedOf, visibleIssues, type CardKey } from "./model";
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
  planBlock: string | null;
  /** When the server copy was last saved (ISO), to tell whether a backup kept in this browser is newer. */
  updatedAt: string;
  /** False on Free: exhbts can be built and previewed, not published. */
  canGoLive: boolean;
  /** The plan's cap for each uploaded file, in MB (ENTITLEMENTS[plan].uploadMbPerFile). */
  maxFileMb: number;
  /** Files the live (published) copy uses, so removing one from the draft doesn't break the live page before the next publish. */
  liveFileIds: string[];
};

const LABELS: Record<string, string> = { title: "Title", context: "Context line", skills: "Skills", headline: "Headline number", gap: "The question", evidence: "The work" };

/** "flow.2.step" becomes "Process, box 3": which part an issue is about, for the list at the top. */
function labelOf(path: string): string {
  const [head, idx] = path.split(".");
  const n = idx !== undefined && /^\d+$/.test(idx) ? Number(idx) + 1 : null;
  if (head === "flow") return n ? `Process, box ${n}` : "Process";
  if (head === "findings") return n ? `Finding ${n}` : "Findings";
  if (head === "images") return n ? `Image ${n}` : "Images";
  if (head === "charts") return n ? `Graph ${n}` : "Graphs";
  if (head === "skills" && n) return `Skill ${n}`;
  return LABELS[head ?? ""] ?? "";
}

const targetOf = (card: CardKey) => (card === "overall" ? "card-publish" : `card-${card}`);

/** Scrolls to a card and puts the cursor in its first field. */
function jumpTo(id: string) {
  const heading = document.getElementById(id);
  if (!heading) return;
  heading.scrollIntoView({ block: "start" });
  heading.closest("section")?.querySelector<HTMLElement>("input:not([type=file]),textarea,[role=textbox],button")?.focus({ preventScroll: true });
}

const GUIDE_KEY = "exhbt-guide-hidden";

/**
 * The exhbt editor: one card per part of the fixed layout, in order (decision 0007, the
 * "halfway" approach), with a live preview drawn by the real ProjectView. Saves as you go
 * (useAutosave: retries, a copy kept in this browser, a warning before leaving unsaved);
 * publishing runs the same checks again on the server.
 */
export function Editor(props: EditorProps) {
  const { id, status, slug, liveBase, owner, planBlock, canGoLive, maxFileMb } = props;
  const [doc, setDoc] = useState<ExhbtDoc>(props.initialDoc);
  const [triedPublish, setTriedPublish] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [justLive, setJustLive] = useState<{ slug: string; changed: boolean } | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [ready, setReady] = useState(false);
  const [offer, setOffer] = useState<Backup | null>(null);
  const [guided] = useState(() => isBlank(props.initialDoc));
  const [guideHidden, setGuideHidden] = useState(false);
  const [imageUrls, setImageUrls] = useState(props.imageUrls);
  const [workUrl, setWorkUrl] = useState<string | null>(props.fileEvidenceUrl);
  const [busy, setBusy] = useState<{ image?: boolean; work?: boolean }>({});
  const [mediaError, setMediaError] = useState<{ image?: string; work?: string }>({});
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
  const over = total > LIMITS.totalWords;
  // When the whole exhbt is over, the card with the most words is where to trim.
  const heaviest = over ? (Object.entries(cw).sort((a, b) => b[1] - a[1])[0]?.[0] as CardKey | undefined) : undefined;
  const flaggedBy = (card: CardKey) => issues.some((i) => cardOf(i.path) === card) || heaviest === card;

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

  async function addImage(file: File | undefined) {
    if (!file) return;
    setMediaError((e) => ({ ...e, image: undefined }));
    const problem = checkFile(file, "image", maxFileMb);
    if (problem) return setMediaError((e) => ({ ...e, image: problem }));
    setBusy((b) => ({ ...b, image: true }));
    try {
      const fileId = await uploadForExhbt(file, "image", id);
      setImageUrls((u) => ({ ...u, [fileId]: URL.createObjectURL(file) }));
      setDoc((d) => (d.images.length >= LIMITS.images.max ? d : { ...d, images: [...d.images, { fileId, alt: "", caption: [] }] }));
    } catch (e) {
      setMediaError((m) => ({ ...m, image: e instanceof UploadError ? e.message : "We couldn't upload that picture." }));
    } finally {
      setBusy((b) => ({ ...b, image: false }));
      if (imageInput.current) imageInput.current.value = "";
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

  function removeWork() {
    if (doc.evidence?.kind === "file") dropFile(doc.evidence.fileId);
    setWorkUrl(null);
    update({ evidence: undefined });
  }

  const evidenceHref = doc.evidence?.kind === "link" ? safeHref(doc.evidence.href) : doc.evidence?.kind === "file" ? workUrl : null;
  const previewDoc: ExhbtDoc = { ...doc, title: doc.title.trim() || "Your title", charts: doc.charts.filter((c) => c.rows.length > 0) };
  const liveUrl = liveBase && slug ? `${liveBase}/${slug}` : null;
  const justLiveUrl = liveBase && justLive ? `${liveBase}/${justLive.slug}` : null;
  const shownLive = canGoLive && status === "published";

  // What stops publishing, listed at the top once they've tried (and always the over-limit ones).
  const problems = [
    ...issues.map((i) => ({ message: labelOf(i.path) ? `${labelOf(i.path)}: ${i.message}` : i.message, target: targetOf(cardOf(i.path)) })),
    ...(triedPublish && result && !result.ok
      ? result.lines.filter((l) => !/^Fix /.test(l)).map((l) => ({ message: l, target: /flagged number/.test(l) ? "card-header" : "card-publish" }))
      : []),
  ];
  const summaryLines = result && !result.ok ? result.lines.filter((l) => /^Fix /.test(l)) : [];

  const steps = stepsFor(doc, shownLive || justLive !== null);
  const showGuide = guided && !guideHidden;
  const chip = !canGoLive ? "Preview only" : status === "published" ? "Live" : "Draft";

  return (
    <div className="editor-touch bg-mist" data-ready={ready || undefined} onBlur={() => void autosave.flush()}>
      <div className="mx-auto max-w-[78rem] px-4 pt-8 pb-16 sm:px-8">
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
            <WordBar total={total} />
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
                  setDoc(offer.doc);
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

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
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
            <Card id="card-header" title="Title and skills" words={cw.header} flagged={flaggedBy("header")} heaviest={heaviest === "header"}>
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
              <div className="space-y-4">
                <TextInput id="title" label="Title" value={doc.title} max={LIMITS.titleChars} onChange={(title) => update({ title })} issues={issuesAt(issues, "title")} placeholder="What you did, and what changed. e.g. Cut cafe queues from 11 to 4 minutes" />
                <TextInput id="context" label="Context line" value={doc.context} max={LIMITS.contextChars} onChange={(context) => update({ context })} issues={issuesAt(issues, "context")} placeholder="e.g. BSc Economics, final-year project" />
                <fieldset>
                  <legend className="label">
                    Headline number <span className="font-normal text-graphite">(optional, shown on your portfolio)</span>
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
              </div>
            </Card>

            <Card id="card-gap" title="The question" words={cw.gap} limit={LIMITS.gapWords} hint="What the question was and why it mattered. Two short sentences." flagged={flaggedBy("gap")} heaviest={heaviest === "gap"}>
              <RichTextField
                labelId="card-gap"
                describedBy="gap-issues"
                value={doc.gap}
                onChange={(gap) => update({ gap })}
                placeholder="e.g. Lunchtime queues ran past ten minutes. Would a second till help?"
              />
              <FieldIssues id="gap-issues" issues={issuesAt(issues, "gap")} />
            </Card>

            <Card id="card-flow" title="Process" words={cw.flow} hint="How you did it, as a flowchart. Type in the boxes." flagged={flaggedBy("flow")} heaviest={heaviest === "flow"}>
              <FlowEditor steps={doc.flow} onChange={(flow) => update({ flow })} issues={issues} />
              <FieldIssues id="flow-issues" issues={issuesAt(issues, "flow")} />
            </Card>

            <Card id="card-findings" title="Findings" words={cw.findings} hint={`${LIMITS.findings.min} to ${LIMITS.findings.max} bullets, up to ${LIMITS.findings.wordsEach} words each.`} flagged={flaggedBy("findings")} heaviest={heaviest === "findings"}>
              <ol className="space-y-4">
                {doc.findings.map((f, i) => (
                  <li key={i}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span id={`finding-${i}`} className="label mb-0">
                        Finding {i + 1}
                      </span>
                      <span className="flex items-center gap-1">
                        <WordsOf n={words(plain(f))} limit={LIMITS.findings.wordsEach} />
                        <Button size="sm" label={`Move finding ${i + 1} up`} disabled={i === 0} onClick={() => update({ findings: swap(doc.findings, i, i - 1) })}>
                          <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
                        </Button>
                        <Button size="sm" label={`Move finding ${i + 1} down`} disabled={i === doc.findings.length - 1} onClick={() => update({ findings: swap(doc.findings, i, i + 1) })}>
                          <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
                        </Button>
                        <Button
                          size="sm"
                          label={`Remove finding ${i + 1}`}
                          disabled={doc.findings.length <= LIMITS.findings.min}
                          onClick={() => update({ findings: doc.findings.filter((_, j) => j !== i) })}
                        >
                          <X aria-hidden size={14} strokeWidth={2.25} />
                        </Button>
                      </span>
                    </div>
                    <RichTextField
                      labelId={`finding-${i}`}
                      describedBy={`finding-${i}-issues`}
                      value={f}
                      onChange={(v) => update({ findings: doc.findings.map((x, j) => (j === i ? v : x)) })}
                      placeholder={i === 0 ? "e.g. Average wait fell from 11 to 4 minutes." : "e.g. Sales held steady, so the till paid for itself."}
                    />
                    <FieldIssues id={`finding-${i}-issues`} issues={issuesAt(issues, `findings.${i}`)} />
                  </li>
                ))}
              </ol>
              <FieldIssues id="findings-issues" issues={issuesAt(issues, "findings")} />
              <div className="mt-4">
                <Button size="sm" disabled={doc.findings.length >= LIMITS.findings.max} onClick={() => update({ findings: [...doc.findings, []] })} label="Add a finding">
                  <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a finding
                </Button>
              </div>
            </Card>

            <Card id="card-charts" title="Graphs" words={cw.charts} hint={`Up to ${LIMITS.charts.max}, only from numbers in your work. Leave them out if there aren't any.`} flagged={flaggedBy("charts")} heaviest={heaviest === "charts"}>
              <div className="space-y-4">
                {doc.charts.map((c, i) => (
                  <ChartEditor
                    key={i}
                    chart={c}
                    index={i}
                    issues={issues}
                    onChange={(next) => update({ charts: doc.charts.map((x, j) => (j === i ? next : x)) })}
                    onRemove={() => update({ charts: doc.charts.filter((_, j) => j !== i) })}
                  />
                ))}
              </div>
              <FieldIssues id="charts-issues" issues={issuesAt(issues, "charts")} />
              {doc.charts.length < LIMITS.charts.max && (
                <div className="mt-4">
                  <Button size="sm" onClick={() => update({ charts: [...doc.charts, newChart()] })} label="Add a graph">
                    <Plus aria-hidden size={14} strokeWidth={2.25} /> Add a graph
                  </Button>
                </div>
              )}
            </Card>

            <Card id="card-images" title="Images" words={cw.images} hint={`Up to ${LIMITS.images.max}, each with a caption of up to ${LIMITS.images.captionWords} words. JPEG, PNG, WebP or GIF, up to ${maxFileMb} MB.`} flagged={flaggedBy("images")} heaviest={heaviest === "images"}>
              <ol className="space-y-5">
                {doc.images.map((im, i) => (
                  <li key={im.fileId} className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                    {imageUrls[im.fileId] ? (
                      <img src={imageUrls[im.fileId]!} alt="" className="w-full rounded-[12px] border border-line" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center rounded-[12px] border border-dashed border-field bg-mist text-slate">
                        <ImageIcon aria-hidden size={24} />
                        <span className="sr-only">Image {i + 1} (preview not available)</span>
                      </div>
                    )}
                    <div className="space-y-3">
                      <TextInput id={`image-${i}-alt`} label={`Image ${i + 1}: describe it for people who can't see it`} value={im.alt} onChange={(alt) => update({ images: doc.images.map((x, j) => (j === i ? { ...x, alt } : x)) })} issues={issuesAt(issues, `images.${i}.alt`)} placeholder="e.g. Bar chart of queue times before and after" />
                      <div>
                        <span id={`image-${i}-caption`} className="label">
                          Image {i + 1} caption
                        </span>
                        <RichTextField labelId={`image-${i}-caption`} describedBy={`image-${i}-caption-issues`} value={im.caption} onChange={(caption) => update({ images: doc.images.map((x, j) => (j === i ? { ...x, caption } : x)) })} />
                        <FieldIssues id={`image-${i}-caption-issues`} issues={issuesAt(issues, `images.${i}.caption`)} />
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        label={`Remove image ${i + 1}`}
                        onClick={() => {
                          dropFile(im.fileId);
                          update({ images: doc.images.filter((_, j) => j !== i) });
                        }}
                      >
                        Remove image
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <FieldIssues id="images-issues" issues={issuesAt(issues, "images")} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input ref={imageInput} type="file" hidden tabIndex={-1} aria-label="Choose an image" accept={IMAGE_ACCEPT} onChange={(e) => void addImage(e.target.files?.[0])} />
                <Button size="sm" disabled={doc.images.length >= LIMITS.images.max || busy.image} loading={busy.image} onClick={() => imageInput.current?.click()} label="Add an image">
                  <Plus aria-hidden size={14} strokeWidth={2.25} /> {busy.image ? "Uploading…" : "Add an image"}
                </Button>
                {doc.images.length >= LIMITS.images.max && <span className="hint">That&apos;s the most images.</span>}
              </div>
              {mediaError.image && (
                <p role="alert" className="mt-2 text-sm text-error">
                  {mediaError.image}
                </p>
              )}
            </Card>

            <Card id="card-evidence" title="The work" words={cw.evidence} hint="One click to the original: a report, a repository, a dashboard. A link, or a file." flagged={flaggedBy("evidence")} heaviest={heaviest === "evidence"}>
              <input ref={workInput} type="file" hidden tabIndex={-1} aria-label="Choose a file" accept={WORK_ACCEPT} onChange={(e) => void attachWork(e.target.files?.[0])} />
              {doc.evidence?.kind === "file" ? (
                <div className="space-y-4">
                  <p>
                    File attached: <strong className="break-all">{doc.evidence.label}</strong>
                  </p>
                  <TextInput
                    id="evidence-label"
                    label="What it is"
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
                    label="What it is"
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
                  <p className="text-graphite">This exhbt is a preview only. Publishing to your own link comes with Premium; until then, nobody else can see it.</p>
                  <Button href="/account/billing" variant="primary">
                    Publish with Premium
                  </Button>
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
                  {planBlock && (
                    <p className="mt-2 text-graphite">
                      {planBlock}{" "}
                      <Link href="/pricing" className="link font-semibold text-ink">
                        See plans
                      </Link>
                    </p>
                  )}
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
            <p className="mb-2 text-sm font-semibold text-graphite">Preview</p>
            <TrustPreview confirmed={confirmed}>
              <ProjectView doc={previewDoc} owner={owner} imageUrls={imageUrls} evidenceUrl={evidenceHref} headingLevel="h2" />
            </TrustPreview>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The total towards the target (150) and the limit (200): the figures and a bar. */
function WordBar({ total }: { total: number }) {
  const { targetWords, totalWords } = LIMITS;
  const over = total > totalWords;
  const pct = Math.min(100, (total / totalWords) * 100);
  return (
    <div className="flex min-w-[14rem] flex-1 items-center gap-3 sm:max-w-md">
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

function Card({
  id,
  title,
  words: n,
  limit,
  hint,
  flagged,
  heaviest,
  children,
}: {
  id: string;
  title: string;
  words?: number;
  limit?: number;
  hint?: string;
  /** Something here needs attention: drawn with an error edge. */
  flagged?: boolean;
  /** The whole exhbt is over the word limit and this card has the most. */
  heaviest?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`rounded-[20px] border bg-surface p-5 sm:p-6 ${flagged ? "border-error" : "border-line"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="scroll-mt-24 text-[1.375rem]">
          {title}
        </h2>
        {n !== undefined && <WordsOf n={n} limit={limit} />}
      </div>
      {hint && <p className="hint mt-1">{hint}</p>}
      {heaviest && (
        <p className="mt-1 text-sm font-semibold text-error">
          The whole exhbt is over {LIMITS.totalWords} words, and this part has the most ({n}). Start trimming here.
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function WordsOf({ n, limit }: { n: number; limit?: number }) {
  const over = limit !== undefined && n > limit;
  return (
    <span className={`font-mono text-sm ${over ? "font-semibold text-error" : "text-graphite"}`}>
      {limit !== undefined ? `${n} / ${limit}` : n} {n === 1 && limit === undefined ? "word" : "words"}
    </span>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  issues,
  max,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  issues: Issue[];
  max?: number;
  placeholder?: string;
  type?: "text" | "url";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {max !== undefined && (
          <span className={`font-mono text-sm ${value.length > max ? "font-semibold text-error" : "text-graphite"}`}>
            {value.length} / {max}
          </span>
        )}
      </div>
      <input
        id={id}
        type={type}
        className="field"
        value={value}
        placeholder={placeholder}
        aria-invalid={issues.length > 0 || undefined}
        aria-describedby={`${id}-issues`}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldIssues id={`${id}-issues`} issues={issues} />
    </div>
  );
}

const swap = <T,>(xs: T[], i: number, j: number): T[] => {
  const next = [...xs];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
};

const headline = (value: string, label: string) => (value.trim() || label.trim() ? { value, label } : undefined);
const evidence = (href: string, label: string): ExhbtDoc["evidence"] => (href.trim() || label.trim() ? { kind: "link", href: href.trim(), label } : undefined);

