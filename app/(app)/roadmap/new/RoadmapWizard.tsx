"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, Upload } from "lucide-react";
import { startRoadmap, type FormState } from "../actions";
import { CvError, extractCvTextInBrowser } from "@/lib/cv-client";
import { SITUATIONS, type Situation } from "@/lib/ai/schemas";
import { SOURCING_LINE } from "@/lib/jobs/claim";

/**
 * Order (docs/decisions/0003-cv-step-and-skill-radar.md): the job, the CV (preferred, skippable),
 * where they are now with anything the CV doesn't cover, email. Results follow.
 */
const STEPS = [
  { title: "Describe the job you want", hint: "A sentence is plenty, e.g. “Data analyst in the NHS, using Python”." },
  {
    title: "Add your CV",
    hint: "This gives you the sharpest roadmap: we compare what your CV shows with what the job asks for. No CV to hand? Skip this and tell us on the next page.",
  },
  { title: "Where are you now?", hint: "So the projects we suggest fit your time and what you can already do." },
  { title: "Where should we send it?", hint: "Your roadmap appears straight away, and we email you a copy so you can come back to it." },
] as const;
const LAST = STEPS.length;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = { defaultRole: string; signedInEmail: string | null };

/**
 * The click-through roadmap builder. All steps stay mounted (inactive ones are hidden)
 * so answers survive Back/Next; the step lives in ?step= so the browser Back button
 * works. One server action submits everything at the end.
 */
export function RoadmapWizard({ defaultRole, signedInEmail }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, action] = useActionState<FormState, FormData>(startRoadmap, undefined);

  const urlStep = Number(params.get("step"));
  const step = urlStep >= 1 && urlStep <= LAST ? urlStep : defaultRole ? 2 : 1;

  const [role, setRole] = useState(defaultRole);
  const [situation, setSituation] = useState<Situation | "">("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState("");
  const [cvMode, setCvMode] = useState<"upload" | "paste">("upload");
  const [cvText, setCvText] = useState("");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [email, setEmail] = useState(signedInEmail ?? "");
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
      e.education = "Tell us a little about your education or skills, or go back and add your CV.";
    if (n === LAST && !EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validate(step)) goTo(step + 1);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setErrors({});
    setCvFileName(file.name);
    try {
      setCvText(await extractCvTextInBrowser(file));
    } catch (err) {
      setCvText("");
      setErrors({ cv: err instanceof CvError ? err.message : "We couldn't read that file. Paste the text instead." });
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
            <Link href="/pricing#premium" className="link font-semibold">Go to pricing</Link>
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
          <p className="mt-3 text-ink-2">{s.hint}</p>

          <div className="mt-7">
            {i === 0 && (
              <Field id="role" label="The job you want" error={errors.targetRole}>
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
                <p className="mt-3 text-sm text-ink-2">{SOURCING_LINE}</p>
              </Field>
            )}

            {i === 1 && (
              <div>
                <div role="radiogroup" aria-label="How to add your CV" className="inline-flex rounded-full border border-rule bg-sky p-1 text-sm font-medium">
                  {(["upload", "paste"] as const).map((m) => (
                    <label
                      key={m}
                      className={`cursor-pointer rounded-full px-4 py-2 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-blue-edge ${
                        cvMode === m ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      <input type="radio" name="cvMode" value={m} checked={cvMode === m} onChange={() => setCvMode(m)} className="sr-only" />
                      {m === "upload" ? "Upload a file" : "Paste the text"}
                    </label>
                  ))}
                </div>

                <div hidden={cvMode !== "upload"} className="mt-4">
                  <label
                    htmlFor="cvFile"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-field bg-sky px-6 py-10 text-center hover:border-blue-edge has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-blue-edge"
                  >
                    <Upload aria-hidden size={26} strokeWidth={1.75} />
                    <span className="text-[1.05rem] font-semibold">{cvFileName ? "Choose a different file" : "Choose your CV"}</span>
                    <span className="hint">PDF or Word (.docx), up to 5 MB. Read in your browser; the file never leaves your device.</span>
                    <input
                      id="cvFile"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                  {reading ? (
                    "Reading your CV…"
                  ) : words > 0 ? (
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="inline-flex size-4 items-center justify-center rounded-full border border-ink bg-green">
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

                {words === 0 && (
                  <button type="button" onClick={() => goTo(3)} disabled={!ready} className="link mt-2 font-semibold text-ink">
                    Skip, I&rsquo;ll type it in instead
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
                          className={`flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 font-semibold has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-blue-edge ${
                            situation === value ? "border-blue-edge bg-sky" : "border-rule hover:border-field"
                          }`}
                        >
                          <input
                            type="radio"
                            name="situation"
                            value={value}
                            checked={situation === value}
                            onChange={() => setSituation(value)}
                            className="size-4 accent-[var(--color-blue-edge)]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <ErrorText id="situation-error" message={errors.situation} />
                </div>
                <Field id="situationDetail" label="Anything to add?" optional>
                  <input
                    id="situationDetail"
                    name="situationDetail"
                    maxLength={200}
                    placeholder="e.g. Second year, Economics at Leeds"
                    className="field"
                  />
                </Field>

                {cvText && (
                  <p className="rounded-[var(--radius)] bg-sky px-4 py-3 text-[0.95rem]">
                    We have your CV. Only add what it doesn&rsquo;t cover, such as a recent course or a project you
                    left off.
                  </p>
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
              </div>
            )}

            {i === 3 && (
              <div className="space-y-6">
                {signedInEmail ? (
                  <p>
                    We&rsquo;ll send it to <span className="font-semibold">{signedInEmail}</span>.
                  </p>
                ) : (
                  <Field id="email" label="Email address" error={errors.email}>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      aria-describedby="email-error"
                      className="field min-h-14 text-[1.15rem]"
                    />
                  </Field>
                )}
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="marketingOptIn" value="yes" className="mt-1 size-5 shrink-0 accent-[var(--color-blue-edge)]" />
                  <span>
                    Email me when new Exhbt features launch.{" "}
                    <span className="text-ink-2">Occasional, and you can unsubscribe in one click.</span>
                  </span>
                </label>
                <p className="hint">
                  By continuing you agree to the <Link href="/legal/terms" className="link">terms</Link> and{" "}
                  <Link href="/legal/privacy" className="link">privacy policy</Link>.
                </p>
              </div>
            )}
          </div>
        </section>
      ))}

      <div className="mt-10 flex items-center justify-between gap-4 border-t border-rule pt-6">
        {step > 1 ? (
          <button type="button" onClick={() => goTo(step - 1)} className="btn btn-secondary">
            <ArrowLeft aria-hidden size={18} strokeWidth={2.25} /> Back
          </button>
        ) : (
          <span />
        )}
        {step < LAST ? (
          <button type="submit" className="btn btn-primary min-h-12 px-6 text-base" disabled={reading || !ready}>
            Continue <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
          </button>
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
      <p className="text-sm font-semibold text-ink-2">
        Step {step} of {STEPS.length}
      </p>
      <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }} aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s.title} className={`h-1.5 rounded-full ${i < step ? "bg-blue-edge" : "bg-sky-2"}`} />
        ))}
      </div>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary min-h-12 px-6 text-base" disabled={pending}>
      {pending ? "Starting…" : "Build my roadmap"} <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
    </button>
  );
}

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {optional && <span className="font-normal text-ink-2">(optional)</span>}
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
