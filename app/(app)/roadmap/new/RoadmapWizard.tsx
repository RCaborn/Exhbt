"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, Upload } from "lucide-react";
import { startRoadmap, type FormState } from "../actions";
import { CV_ACCEPT, CvError, CvNeedsServer, extractCvTextInBrowser, readCvOnServer } from "@/lib/cv-client";
import { SITUATIONS, type RoadmapInput, type Situation } from "@/lib/ai/schemas";
import { Button } from "@/components/ui/Button";

/**
 * Order (docs/decisions/0003 and 0004): the job, the CV (preferred, skippable), where they are
 * now with anything the CV doesn't cover. Results follow straight away; the email is asked for
 * at the project-ideas gate, after the radar.
 */
// Minimal words on every step (Rory, 9 Nov 2026): a title, the fields, at most one short line.
const STEPS = [
  { title: "What job do you want?", hint: "" },
  { title: "Add your CV", hint: "It gives you the sharpest roadmap." },
  { title: "Where are you now?", hint: "" },
] as const;
const LAST = STEPS.length;

type Props = {
  defaultRole: string;
  /** The details of an earlier roadmap, to start from when someone builds one for a different job. */
  initial?: Pick<RoadmapInput, "situation" | "situationDetail" | "education" | "skills" | "cvText">;
};

/**
 * The click-through roadmap builder. All steps stay mounted (inactive ones are hidden)
 * so answers survive Back/Next; the step lives in ?step= so the browser Back button
 * works. One server action submits everything at the end.
 */
export function RoadmapWizard({ defaultRole, initial }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, action] = useActionState<FormState, FormData>(startRoadmap, undefined);

  const urlStep = Number(params.get("step"));
  const step = urlStep >= 1 && urlStep <= LAST ? urlStep : defaultRole ? 2 : 1;

  const [role, setRole] = useState(defaultRole);
  const [situation, setSituation] = useState<Situation | "">(initial?.situation ?? "");
  const [education, setEducation] = useState(initial?.education ?? "");
  const [skills, setSkills] = useState(initial?.skills ?? "");
  const [cvMode, setCvMode] = useState<"upload" | "paste">(initial?.cvText ? "paste" : "upload");
  const [cvText, setCvText] = useState(initial?.cvText ?? "");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [reading, setReading] = useState<false | "device" | "server">(false);
  // A scan or photo the browser couldn't read: held until the visitor chooses to send it or paste.
  const [pendingFile, setPendingFile] = useState<{ file: File; kind: "scan" | "image" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const first = useRef(true);
  // Buttons stay inert until the page is interactive, so early clicks can't lose answers.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const goTo = (n: number) => {
    const q = new URLSearchParams(params.toString());
    q.set("step", String(n));
    router.push(`${pathname}?${q}`, { scroll: false });
  };

  // Move focus to the new question so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRefs.current[step - 1]?.focus();
  }, [step]);

  // Server-side validation can send the visitor back to a step.
  useEffect(() => {
    if (!state) return;
    setErrors({ ...(state.fieldErrors ?? {}) });
    if (state.step && state.step !== step) goTo(state.step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function validate(n: number): boolean {
    const e: Record<string, string> = {};
    if (n === 1 && role.trim().length < 2) e.targetRole = "Describe the job you want.";
    // Step 2 (the CV) can always be skipped.
    if (n === 3 && !situation) e.situation = "Choose the option closest to where you are now.";
    if (n === 3 && (education + skills + cvText).replace(/\s/g, "").length < 20)
      e.education = "Add your education or skills, or go back and add your CV.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validate(step)) goTo(step + 1);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading("device");
    setErrors({});
    setPendingFile(null);
    setCvFileName(file.name);
    try {
      setCvText(await extractCvTextInBrowser(file));
    } catch (err) {
      setCvText("");
      if (err instanceof CvNeedsServer) setPendingFile({ file, kind: err.kind });
      else setErrors({ cv: err instanceof CvError ? err.message : "We couldn't read that file. Paste it instead." });
    } finally {
      setReading(false);
    }
  }

  /** The visitor agreed to send a scan or photo to be read by the AI. */
  async function readPendingOnServer() {
    if (!pendingFile) return;
    setReading("server");
    setErrors({});
    try {
      setCvText(await readCvOnServer(pendingFile.file));
      setPendingFile(null);
    } catch (err) {
      setErrors({ cv: err instanceof CvError ? err.message : "We couldn't read that file. Paste it instead." });
    } finally {
      setReading(false);
    }
  }

  const words = cvText.trim() ? cvText.trim().split(/\s+/).length : 0;

  return (
    <form
      action={action}
      noValidate
      data-ready={ready ? "true" : undefined}
      onSubmit={(e) => {
        // Enter on earlier steps moves forward; only the last step actually submits.
        if (step < LAST) {
          e.preventDefault();
          next();
        } else if (!validate(LAST)) {
          e.preventDefault();
        }
      }}
    >
      <Progress step={step} />

      {state?.error && (
        <p role="alert" className="mt-6 rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
          {state.error}{" "}
          {state.error.includes("waitlist") && (
            <Link href="/pricing#max" className="link font-semibold">Go to pricing</Link>
          )}
        </p>
      )}

      {/* Hidden fields carry the controlled answers in the single final submit. */}
      <input type="hidden" name="targetRole" value={role} />
      <input type="hidden" name="cvText" value={cvText} />

      {STEPS.map((s, i) => (
        <section key={s.title} hidden={step !== i + 1} aria-labelledby={`step-${i + 1}`} className="mt-8">
          <h2
            id={`step-${i + 1}`}
            ref={(el) => {
              headingRefs.current[i] = el;
            }}
            tabIndex={-1}
            className="text-[2rem] focus:outline-none sm:text-[2.6rem]"
          >
            {s.title}
          </h2>
          {s.hint && <p className="mt-3 text-graphite">{s.hint}</p>}

          <div className="mt-7">
            {i === 0 && (
              <Field id="role" label="The job you want" hideLabel error={errors.targetRole}>
                <textarea
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. Junior data analyst in the NHS"
                  aria-describedby="role-error"
                  className="field text-[1.1rem]"
                  autoFocus={step === 1}
                />
              </Field>
            )}

            {i === 1 && (
              <div>
                <div role="radiogroup" aria-label="How to add your CV" className="inline-flex rounded-full border border-line bg-mist p-1 text-sm font-medium">
                  {(["upload", "paste"] as const).map((m) => (
                    <label
                      key={m}
                      className={`cursor-pointer rounded-full px-4 py-2 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-jade ${
                        cvMode === m ? "bg-surface text-ink shadow-sm" : "text-graphite hover:text-ink"
                      }`}
                    >
                      <input type="radio" name="cvMode" value={m} checked={cvMode === m} onChange={() => setCvMode(m)} className="sr-only" />
                      {m === "upload" ? "Upload" : "Paste"}
                    </label>
                  ))}
                </div>

                <div hidden={cvMode !== "upload"} className="mt-4">
                  <label
                    htmlFor="cvFile"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-field bg-mist px-6 py-10 text-center hover:border-jade has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-jade"
                  >
                    <Upload aria-hidden size={26} strokeWidth={1.75} />
                    <span className="text-[1.05rem] font-semibold">{cvFileName ? "Choose a different file" : "Choose your CV"}</span>
                    <span className="hint text-graphite">PDF, Word, text file or a photo of it.</span>
                    <input
                      id="cvFile"
                      type="file"
                      accept={CV_ACCEPT}
                      className="sr-only"
                      aria-describedby="cv-status cv-error"
                      onChange={(e) => onFile(e.target.files?.[0])}
                    />
                  </label>
                </div>

                <div hidden={cvMode !== "paste"} className="mt-4">
                  <label htmlFor="cvPaste" className="sr-only">CV text</label>
                  <textarea
                    id="cvPaste"
                    rows={8}
                    value={cvText}
                    onChange={(e) => {
                      setCvText(e.target.value);
                      setCvFileName(null);
                    }}
                    placeholder="Paste your CV here"
                    aria-describedby="cv-status cv-error"
                    className="field"
                  />
                </div>

                <p id="cv-status" className="mt-3 min-h-6 text-sm" aria-live="polite">
                  {reading === "device" ? (
                    "Reading your CV…"
                  ) : reading === "server" ? (
                    "Reading your CV. Scans can take up to 30 seconds…"
                  ) : words > 0 ? (
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="inline-flex size-4 items-center justify-center rounded-full border border-ink bg-mint">
                        <Check aria-hidden size={10} strokeWidth={3} />
                      </span>
                      {cvFileName ? (
                        <>
                          <FileText aria-hidden size={14} /> Read {words.toLocaleString("en-GB")} words from {cvFileName}
                        </>
                      ) : (
                        <>{words.toLocaleString("en-GB")} words</>
                      )}
                    </span>
                  ) : null}
                </p>
                <ErrorText id="cv-error" message={errors.cv} />

                {pendingFile && !reading && (
                  <div role="group" aria-labelledby="cv-scan-title" className="mt-4 rounded-[14px] border border-line bg-mist p-5">
                    <p id="cv-scan-title" className="font-semibold">
                      {pendingFile.kind === "image" ? "That's a photo, so we can't read it on your device." : "That PDF looks like a scan, so we can't read it on your device."}
                    </p>
                    <p className="mt-1 text-sm text-graphite">
                      We can send it to our AI reader to turn it into text. We don&rsquo;t keep the file.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button variant="primary" onClick={readPendingOnServer}>Read it for me</Button>
                      <Button
                        onClick={() => {
                          setPendingFile(null);
                          setCvFileName(null);
                          setCvMode("paste");
                        }}
                      >
                        Paste the text instead
                      </Button>
                    </div>
                  </div>
                )}

                {cvFileName && words > 0 && !reading && cvMode === "upload" && (
                  <button type="button" onClick={() => setCvMode("paste")} className="link mt-2 mr-4 text-sm text-ink">
                    Check or edit what we read
                  </button>
                )}

                {words === 0 && (
                  <button type="button" onClick={() => goTo(3)} disabled={!ready} className="link mt-2 font-semibold text-ink">
                    Skip for now
                  </button>
                )}
              </div>
            )}

            {i === 2 && (
              <div className="space-y-5">
                <div>
                  <fieldset aria-describedby="situation-error">
                    <legend className="sr-only">Where you are now</legend>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {(Object.entries(SITUATIONS) as [Situation, string][]).map(([value, label]) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 font-semibold has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-jade ${
                            situation === value ? "border-jade bg-mist" : "border-line hover:border-field"
                          }`}
                        >
                          <input
                            type="radio"
                            name="situation"
                            value={value}
                            checked={situation === value}
                            onChange={() => setSituation(value)}
                            className="size-4 accent-[var(--color-jade)]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <ErrorText id="situation-error" message={errors.situation} />
                </div>
                <Field id="situationDetail" label="Details" optional>
                  <input
                    id="situationDetail"
                    name="situationDetail"
                    defaultValue={initial?.situationDetail ?? ""}
                    maxLength={200}
                    placeholder="e.g. Second year, Economics at Leeds"
                    className="field"
                  />
                </Field>

                {cvText && (
                  <p className="rounded-[var(--radius)] bg-mist px-4 py-3 text-[0.95rem]">Got your CV. Add anything it misses.</p>
                )}
                <Field id="education" label="Education" optional={!!cvText} error={errors.education}>
                  <textarea
                    id="education"
                    name="education"
                    rows={3}
                    maxLength={1000}
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="Course, university, expected grade, modules you enjoyed"
                    aria-describedby="education-error"
                    className="field"
                  />
                </Field>
                <Field id="skills" label="Skills and experience" optional>
                  <textarea
                    id="skills"
                    name="skills"
                    rows={3}
                    maxLength={1000}
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="Tools, languages, part-time jobs, societies, projects"
                    className="field"
                  />
                </Field>
                <p className="hint">
                  By continuing you agree to the <Link href="/legal/terms" className="link">terms</Link> and{" "}
                  <Link href="/legal/privacy" className="link">privacy policy</Link>.
                </p>
              </div>
            )}

          </div>
        </section>
      ))}

      <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
        {step > 1 ? (
          <Button label="Back" onClick={() => goTo(step - 1)}>
            <ArrowLeft aria-hidden size={18} strokeWidth={2.25} /> Back
          </Button>
        ) : (
          <span />
        )}
        {step < LAST ? (
          <Button type="submit" variant="primary" size="lg" label="Continue" disabled={Boolean(reading) || !ready}>
            Continue <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
          </Button>
        ) : (
          <Submit />
        )}
      </div>
    </form>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div>
      <p className="text-sm font-semibold text-graphite">
        Step {step} of {STEPS.length}
      </p>
      <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }} aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s.title} className={`h-1.5 rounded-full ${i < step ? "bg-jade" : "bg-wash"}`} />
        ))}
      </div>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" label="See my roadmap" loading={pending}>
      {pending ? "Starting…" : "See my roadmap"} <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
    </Button>
  );
}

function Field({
  id,
  label,
  optional,
  hideLabel,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  /** For a field whose step title already asks the question: the label stays for screen readers. */
  hideLabel?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "label"}>
        {label} {optional && <span className="font-normal text-graphite">(optional)</span>}
      </label>
      {children}
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  );
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="mt-1.5 min-h-5 text-sm text-error" aria-live="polite">
      {message}
    </p>
  );
}
