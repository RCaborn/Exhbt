"use client";

/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see components/portfolio/Avatar.tsx. */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ImageIcon, Plus, X } from "lucide-react";
import { deleteExhbt, publishExhbt, saveDraft, unpublishExhbt } from "@/app/(app)/exhbts/[id]/actions";
import { ProjectView, type Owner } from "@/components/portfolio/ProjectView";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import type { Plan } from "@/lib/entitlements";
import { LIMITS, plain, safeHref, validateForPublish, wordCount, words, type ExhbtDoc, type Issue } from "@/lib/exhbt/blocks";
import { BlockTools, useDraftTools, type DraftToolsInit } from "./BlockTools";
import { ChartEditor, newChart } from "./ChartEditor";
import { ConfirmAction } from "./ConfirmAction";
import { FieldIssues } from "./FieldIssues";
import { FlowEditor } from "./FlowEditor";
import { cardWords, confirmNumber, issuesAt, unverifiedOf, visibleIssues } from "./model";
import { SkillsInput } from "./SkillsInput";

/** Tiptap loads in its own chunk, only here, and only in the browser (docs/phase-2.md section 6). */
const RichTextField = dynamic(() => import("./RichTextField").then((m) => m.RichTextField), {
  ssr: false,
  loading: () => <div aria-hidden className="field mt-[2.4rem] min-h-[2.9rem]" />,
});

const SAVE_AFTER_MS = 1500;

type SaveState = "saved" | "waiting" | "saving" | "error";

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
  /** Rewrite and "Back to the AI version"; null or missing when the exhbt has no kept source text. */
  draftTools?: DraftToolsInit;
};

/**
 * The exhbt editor: one card per part of the fixed layout, in order (decision 0007, the
 * "halfway" approach), with a live preview drawn by the real ProjectView. Saves as you go;
 * publishing runs the same checks again on the server.
 */
export function Editor(props: EditorProps) {
  const { id, status, slug, liveBase, owner, imageUrls, fileEvidenceUrl, planBlock } = props;
  const [doc, setDoc] = useState<ExhbtDoc>(props.initialDoc);
  const [save, setSave] = useState<{ state: SaveState; error?: string }>({ state: "saved" });
  const [triedPublish, setTriedPublish] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [ready, setReady] = useState(false);
  // The doc as last loaded or saved: no autosave until it changes (effects run twice in development).
  const lastSaved = useRef(props.initialDoc);
  const saveNo = useRef(0);

  useEffect(() => setReady(true), []);

  // Autosave, about 1.5 s after the last change. Never blocked by the limits.
  useEffect(() => {
    if (doc === lastSaved.current) return;
    setSave({ state: "waiting" });
    const n = ++saveNo.current;
    const t = setTimeout(async () => {
      setSave({ state: "saving" });
      try {
        const r = await saveDraft(id, doc);
        if (r.ok) lastSaved.current = doc;
        if (n === saveNo.current) setSave(r.ok ? { state: "saved" } : { state: "error", error: r.error });
      } catch {
        if (n === saveNo.current) setSave({ state: "error", error: "Couldn't reach the server. Your changes are kept here; it will try again." });
      }
    }, SAVE_AFTER_MS);
    return () => clearTimeout(t);
  }, [doc, id]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (save.state === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.state]);

  const all = useMemo(() => validateForPublish(doc), [doc]);
  const issues = useMemo(() => visibleIssues(doc, all, triedPublish), [doc, all, triedPublish]);
  const total = wordCount(doc);
  const cw = cardWords(doc);
  const flags = unverifiedOf(doc);

  const dt = useDraftTools(id, props.draftTools, doc, setDoc);
  const update = (patch: Partial<ExhbtDoc>) => setDoc((d) => ({ ...d, ...patch }));

  async function publish() {
    setTriedPublish(true);
    setPublishing(true);
    setResult(null);
    try {
      const r = await publishExhbt(id, doc, confirmed);
      if (r.ok) {
        setSave({ state: "saved" });
        setResult({ ok: true, lines: [status === "published" ? "Your changes are live." : "It's live."] });
      } else {
        setResult({ ok: false, lines: r.reasons });
      }
    } catch {
      setResult({ ok: false, lines: ["Couldn't reach the server. Try again in a moment."] });
    } finally {
      setPublishing(false);
    }
  }

  const evidenceHref = doc.evidence?.kind === "link" ? safeHref(doc.evidence.href) : fileEvidenceUrl;
  const previewDoc: ExhbtDoc = { ...doc, title: doc.title.trim() || "Your title", charts: doc.charts.filter((c) => c.rows.length > 0) };
  const liveUrl = liveBase && slug ? `${liveBase}/${slug}` : null;

  return (
    <div className="bg-mist" data-ready={ready || undefined}>
      <div className="mx-auto max-w-[90rem] px-4 pt-8 pb-16 sm:px-8">
        <Link href="/exhbts" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> Your exhbts
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h1 className="text-[2rem] sm:text-[2.5rem]">Edit exhbt</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="chip">{status === "published" ? "Live" : "Draft"}</span>
            <span className="font-mono text-graphite">
              <span className={total > LIMITS.totalWords ? "font-semibold text-error" : "text-ink"}>{total}</span> words · aim for {LIMITS.targetWords}, at most {LIMITS.totalWords}
            </span>
            <span role="status" className={save.state === "error" ? "text-error" : "text-graphite"}>
              {save.state === "saved" ? "Saved" : save.state === "error" ? `Not saved. ${save.error}` : "Saving…"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2 lg:hidden">
          <Button size="sm" variant={view === "edit" ? "ink" : "secondary"} onClick={() => setView("edit")}>
            Edit
          </Button>
          <Button size="sm" variant={view === "preview" ? "ink" : "secondary"} onClick={() => setView("preview")}>
            Preview
          </Button>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className={`space-y-5 ${view === "preview" ? "hidden lg:block" : ""}`}>
            <Card id="card-header" title="Title and skills" words={cw.header}>
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
                <TextInput id="title" label="Title" value={doc.title} max={LIMITS.titleChars} onChange={(title) => update({ title })} issues={issuesAt(issues, "title")} placeholder="What you did, and what changed" />
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
                <BlockTools dt={dt} block="skills" />
              </div>
            </Card>

            <Card id="card-gap" title="The question" words={cw.gap} limit={LIMITS.gapWords} hint="What the question was and why it mattered. Two short sentences.">
              <BlockTools dt={dt} block="gap" />
              <RichTextField labelId="card-gap" describedBy="gap-issues" value={doc.gap} onChange={(gap) => update({ gap })} />
              <FieldIssues id="gap-issues" issues={issuesAt(issues, "gap")} />
            </Card>

            <Card id="card-flow" title="Process" words={cw.flow} hint="How you did it, as a flowchart. Type in the boxes.">
              <BlockTools dt={dt} block="flow" />
              <FlowEditor steps={doc.flow} onChange={(flow) => update({ flow })} issues={issues} />
              <FieldIssues id="flow-issues" issues={issuesAt(issues, "flow")} />
            </Card>

            <Card id="card-findings" title="Findings" words={cw.findings} hint={`${LIMITS.findings.min} to ${LIMITS.findings.max} bullets, up to ${LIMITS.findings.wordsEach} words each.`}>
              <BlockTools dt={dt} block="findings" />
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
                    <RichTextField labelId={`finding-${i}`} describedBy={`finding-${i}-issues`} value={f} onChange={(v) => update({ findings: doc.findings.map((x, j) => (j === i ? v : x)) })} />
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

            <Card id="card-charts" title="Graphs" words={cw.charts} hint={`Up to ${LIMITS.charts.max}, only from numbers in your work. Leave them out if there aren't any.`}>
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

            <Card id="card-images" title="Images" words={cw.images} hint={`Up to ${LIMITS.images.max}, each with a caption of up to ${LIMITS.images.captionWords} words.`}>
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
                      <TextInput id={`image-${i}-alt`} label={`Image ${i + 1}: describe it for people who can't see it`} value={im.alt} onChange={(alt) => update({ images: doc.images.map((x, j) => (j === i ? { ...x, alt } : x)) })} issues={issuesAt(issues, `images.${i}.alt`)} />
                      <div>
                        <span id={`image-${i}-caption`} className="label">
                          Image {i + 1} caption
                        </span>
                        <RichTextField labelId={`image-${i}-caption`} describedBy={`image-${i}-caption-issues`} value={im.caption} onChange={(caption) => update({ images: doc.images.map((x, j) => (j === i ? { ...x, caption } : x)) })} />
                        <FieldIssues id={`image-${i}-caption-issues`} issues={issuesAt(issues, `images.${i}.caption`)} />
                      </div>
                      <Button size="sm" variant="danger" label={`Remove image ${i + 1}`} onClick={() => update({ images: doc.images.filter((_, j) => j !== i) })}>
                        Remove image
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <FieldIssues id="images-issues" issues={issuesAt(issues, "images")} />
              {/* TODO(uploads): enable once the uploads helper (app/(app)/exhbts/new, app/api/files) can store a file and return its exhbt_files id; then push { fileId, alt: "", caption: [] } onto doc.images. */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button size="sm" disabled label="Add an image">
                  <Plus aria-hidden size={14} strokeWidth={2.25} /> Add an image
                </Button>
                <span className="hint">Adding images arrives with file uploads.</span>
              </div>
            </Card>

            <Card id="card-evidence" title="The work" words={cw.evidence} hint="One click to the original: a report, a repository, a dashboard.">
              {doc.evidence?.kind === "file" ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    File attached: <strong>{doc.evidence.label}</strong>
                  </span>
                  <Button size="sm" variant="danger" onClick={() => update({ evidence: undefined })} label="Remove the file">
                    Remove
                  </Button>
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
                  {/* TODO(uploads): attaching a file as the work needs the same uploads helper as images. */}
                  <p className="hint">Attaching a file arrives with file uploads.</p>
                </div>
              )}
            </Card>

            <section aria-labelledby="card-publish" className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
              <h2 id="card-publish" className="text-[1.375rem]">
                {status === "published" ? "Live" : "Publish"}
              </h2>
              {liveUrl && status === "published" && (
                <p className="mt-2">
                  Live at{" "}
                  <a href={liveUrl} className="link font-semibold break-all">
                    {liveUrl.replace(/^https:\/\//, "")}
                  </a>
                </p>
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
                {result && (
                  <ul className={`space-y-1 ${result.ok ? "font-semibold text-ink" : "text-error"}`}>
                    {result.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-6 border-t border-line pt-4">
                <ConfirmAction label="Delete exhbt" variant="danger" question="Delete it for good?" confirmLabel="Yes, delete" action={() => deleteExhbt(id)} />
              </div>
            </section>
          </div>

          <section aria-label="Preview" className={view === "edit" ? "hidden lg:block" : ""}>
            <p className="mb-2 text-sm font-semibold text-graphite">Preview</p>
            <ProjectView doc={previewDoc} owner={owner} imageUrls={imageUrls} evidenceUrl={evidenceHref} headingLevel="h2" />
          </section>
        </div>
      </div>
    </div>
  );
}

function Card({ id, title, words: n, limit, hint, children }: { id: string; title: string; words?: number; limit?: number; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-[1.375rem]">
          {title}
        </h2>
        {n !== undefined && <WordsOf n={n} limit={limit} />}
      </div>
      {hint && <p className="hint mt-1">{hint}</p>}
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

