"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import type { Plan } from "@/lib/entitlements";
import { normaliseLinkedin } from "@/lib/cv-contact";
import { checkTiles } from "@/lib/portfolio-customise";
import { normaliseGithub, normaliseWebsite } from "@/lib/portfolio-layout";
import { profileProblems, type ProfileDraft } from "@/lib/portfolio-profile";
import { DEFAULT_THEME, themeById } from "@/lib/portfolio-themes";
import { useHydrated } from "@/lib/use-hydrated";
import { saveBuilderAction } from "./actions";
import { Preview } from "./Preview";
import { StepLook } from "./StepLook";
import { StepProjects } from "./StepProjects";
import { StepPublish } from "./StepPublish";
import { StepYou } from "./StepYou";
import { isStep, STEPS, type BuilderPlan, type BuilderProject, type BuilderState, type Step, type ThemeLock } from "./steps";
import { useBuilder } from "./useBuilder";

/**
 * Build your portfolio (decision 0016): one guided flow, You, Your look, Your projects and Publish,
 * with a progress rail, a live preview of the whole page (beside the steps on a wide screen, under
 * them on a phone) and autosave with one quiet status line. Every change shows in the preview at
 * once and saves itself about half a second later (useBuilder); the server checks it all again.
 */

const TITLES: Record<Step, string> = {
  you: "About you",
  look: "Your look",
  projects: "Your projects",
  publish: "Publish and share",
};
const INTROS: Record<Step, string> = {
  you: "Your name, a photo and a few lines in your own words. This is what an employer reads first.",
  look: "",
  projects: "",
  publish: "",
};

const STATUS_TEXT = { saved: "Saved", pending: "Saving soon", saving: "Saving" } as const;

type Props = {
  step: Step;
  initial: BuilderState;
  projects: BuilderProject[];
  drafts: { id: string; title: string; live: boolean }[];
  photoUrl: string | null;
  username: string | null;
  plan: BuilderPlan;
  addressBlocked: { reason: string; upgradeTo?: Plan } | null;
  locks: Record<string, ThemeLock>;
  savedButLocked: string | null;
  viewHref: string | null;
};

/** The first thing stopping a save, or null. */
function problemOf(s: BuilderState): string | null {
  return Object.values(profileProblems(s.profile))[0] ?? Object.values(checkTiles(s.arrangement.tiles, s.arrangement.order).problems)[0] ?? null;
}

/** The person as the preview draws them: what's typed, with links only once they're real https addresses. */
function personOf(p: ProfileDraft, username: string | null, photoUrl: string | null, showLinkedin: boolean): PortfolioPerson {
  const email = p.contactEmail.trim();
  return {
    username,
    name: p.name.trim() || username || "Your name",
    headline: p.headline.trim() || null,
    bio: p.bio.trim() || null,
    location: p.location.trim() || null,
    lookingFor: p.lookingFor.trim() || null,
    photoUrl,
    links: {
      linkedin: showLinkedin && p.linkedin ? normaliseLinkedin(p.linkedin) : null,
      github: p.github ? normaliseGithub(p.github) : null,
      website: p.website ? normaliseWebsite(p.website) : null,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null,
    },
  };
}

export function Builder(props: Props) {
  const { initial, projects, drafts, photoUrl, username, plan, addressBlocked, locks, savedButLocked, viewHref } = props;
  const ready = useHydrated();
  const { state, status, change, undo, undoable, retry } = useBuilder<BuilderState>(initial, saveBuilderAction, problemOf);
  const [step, setStep] = useState<Step>(props.step);
  const [visited, setVisited] = useState<Set<Step>>(() => new Set([props.step]));
  const [lockedPick, setLockedPick] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  // Back and forward in the browser move between steps.
  useEffect(() => {
    const onPop = () => {
      const s = new URLSearchParams(window.location.search).get("step");
      setStep(isStep(s) ? s : "you");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // After a step change (not the first render), focus its heading so a screen reader hears where it is.
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  const go = (next: Step) => {
    if (next === step) return;
    moved.current = true;
    setStep(next);
    setVisited((v) => new Set(v).add(next));
    window.history.pushState(null, "", `?step=${next}`);
  };

  const index = STEPS.findIndex((s) => s.id === step);
  const a = state.arrangement;
  const theme = themeById(lockedPick ?? a.themeId) ?? DEFAULT_THEME;
  const person = personOf(state.profile, username, photoUrl, a.header.linkedin);
  const listed = new Set(projects.map((p) => p.id));
  const counts = {
    live: projects.filter((p) => p.live && !a.hidden.includes(p.id)).length,
    hidden: a.hidden.filter((id) => listed.has(id)).length,
    drafts: drafts.filter((d) => !d.live).length,
  };
  const done: Record<Step, boolean> = {
    you: Boolean(state.profile.name.trim() && (photoUrl || state.profile.bio.trim())),
    look: visited.has("look") || a.themeId !== DEFAULT_THEME.id,
    projects: counts.live > 0,
    publish: Boolean(username) && plan.isPublic && counts.live > 0,
  };

  const setProfile = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K], undoLabel?: string) =>
    change((s) => ({ ...s, profile: { ...s.profile, [key]: value } }), undoLabel);
  const changeArrangement = (update: (x: BuilderState["arrangement"]) => BuilderState["arrangement"], undoLabel?: string) =>
    change((s) => {
      const next = update(s.arrangement);
      return next === s.arrangement ? s : { ...s, arrangement: next };
    }, undoLabel);
  const pickLook = (id: string) => {
    if (locks[id]) return setLockedPick(id);
    setLockedPick(null);
    changeArrangement((x) => ({ ...x, themeId: id }), `Changed the look to ${themeById(id)?.name ?? id}`);
  };
  const parkFocus = () => requestAnimationFrame(() => undoButton.current?.focus({ preventScroll: true }));

  const statusLine =
    status.kind === "invalid" ? `Not saved yet. ${status.message}` : status.kind === "error" ? `Couldn’t save. ${status.message}` : STATUS_TEXT[status.kind];

  return (
    <div className="bg-mist" data-ready={ready ? "true" : undefined}>
      <div className="mx-auto max-w-[84rem] px-4 pt-8 pb-16 sm:px-8 lg:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h1>Build your portfolio</h1>
          {viewHref && (
            <a href={viewHref} className="link text-sm font-semibold">
              View my portfolio
            </a>
          )}
        </div>

        <nav aria-label="Steps" className="mt-6">
          <p className="mb-2 text-sm text-graphite sm:hidden">
            Step {index + 1} of {STEPS.length}
          </p>
          <ol className="grid grid-cols-4 gap-2 sm:gap-3">
            {STEPS.map((s, i) => {
              const current = s.id === step;
              return (
                <li key={s.id}>
                  <a
                    href={`?step=${s.id}`}
                    aria-current={current ? "step" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      go(s.id);
                    }}
                    className="group block rounded-[6px] pt-0.5 focus-visible:outline-offset-4"
                  >
                    <span aria-hidden className={`block h-1.5 rounded-full ${current ? "bg-ink" : done[s.id] ? "bg-jade" : "bg-line"}`} />
                    <span className={`mt-2 flex items-center gap-1.5 text-sm ${current ? "font-semibold text-ink" : "text-graphite group-hover:text-ink"}`}>
                      {done[s.id] && !current ? (
                        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-mint text-ink">
                          <Check aria-hidden size={11} strokeWidth={3} />
                        </span>
                      ) : (
                        <span aria-hidden className="tabular-nums">
                          {i + 1}
                        </span>
                      )}
                      <span className={current ? "" : "max-sm:sr-only"}>{s.label}</span>
                      {done[s.id] && <span className="sr-only"> (done)</span>}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0">
            {/* Status and undo stay in view while the step scrolls. */}
            <div className="sticky top-0 z-20 -mx-4 border-y border-line bg-surface px-4 py-2 sm:mx-0 sm:rounded-[14px] sm:border">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p
                  role="status"
                  data-testid="save-status"
                  data-state={status.kind}
                  className={`text-sm ${status.kind === "error" || status.kind === "invalid" ? "font-semibold text-error" : "text-graphite"}`}
                >
                  {statusLine}
                </p>
                {status.kind === "error" && (
                  <button type="button" onClick={retry} className="link text-sm font-semibold">
                    Try again
                  </button>
                )}
                <span className="flex-1" />
                <button
                  ref={undoButton}
                  type="button"
                  onClick={undo}
                  disabled={!undoable}
                  aria-label={undoable ? `Undo: ${undoable.label}` : "Undo"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-ink disabled:opacity-45"
                >
                  <Undo2 aria-hidden size={15} strokeWidth={2.25} /> Undo
                </button>
              </div>
            </div>

            <section aria-labelledby="step-heading" className="editor-touch mt-4 rounded-[20px] border border-line bg-surface p-5 sm:p-8">
              <h2 id="step-heading" ref={heading} tabIndex={-1} className="text-[1.75rem] focus:outline-none">
                {TITLES[step]}
              </h2>
              {INTROS[step] && <p className="mt-2 text-graphite">{INTROS[step]}</p>}
              <div className="mt-6">
                {step === "you" && (
                  <StepYou
                    profile={state.profile}
                    problems={profileProblems(state.profile)}
                    set={setProfile}
                    showLinkedin={a.header.linkedin}
                    setShowLinkedin={(on) => changeArrangement((x) => ({ ...x, header: { ...x.header, linkedin: on } }), `Turned LinkedIn ${on ? "on" : "off"}`)}
                    photo={{ url: photoUrl, maxMb: plan.uploadMb }}
                    ready={ready}
                  />
                )}
                {step === "look" && (
                  <StepLook
                    picked={lockedPick ?? a.themeId}
                    onPick={pickLook}
                    locks={locks}
                    savedButLocked={savedButLocked}
                    person={{ name: person.name, headline: person.headline ?? "", photoUrl }}
                    ready={ready}
                  />
                )}
                {step === "projects" && (
                  <StepProjects state={a} change={changeArrangement} projects={projects} drafts={drafts} plan={plan} ready={ready} onFocusLost={parkFocus} />
                )}
                {step === "publish" && (
                  <StepPublish
                    username={username}
                    viewHref={viewHref}
                    addressBlocked={addressBlocked}
                    plan={plan}
                    counts={counts}
                    hideFromSearch={state.profile.hideFromSearch}
                    setHideFromSearch={(on) => setProfile("hideFromSearch", on)}
                    ready={ready}
                  />
                )}
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
                {index > 0 ? (
                  <Button onClick={() => go(STEPS[index - 1]!.id)}>Back</Button>
                ) : (
                  <span />
                )}
                {index < STEPS.length - 1 ? (
                  <Button variant="primary" onClick={() => go(STEPS[index + 1]!.id)} label={`Continue to ${STEPS[index + 1]!.label.toLowerCase()}`}>
                    Continue
                  </Button>
                ) : viewHref && plan.isPublic && counts.live > 0 ? (
                  <Button variant="primary" href={viewHref}>
                    View my portfolio
                  </Button>
                ) : (
                  <Button variant="primary" href="/exhbts">
                    Go to your exhbts
                  </Button>
                )}
              </div>
            </section>
          </div>

          <aside aria-label="Preview of your portfolio" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <p className="mb-2 text-sm font-semibold text-graphite">Preview</p>
            <div tabIndex={0} aria-label="Preview, scrolls" className="overflow-hidden rounded-[20px] border border-line bg-mist shadow-pack lg:max-h-[calc(100svh-4rem)] lg:overflow-y-auto">
              <Preview state={state} person={person} theme={theme} projects={projects} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
