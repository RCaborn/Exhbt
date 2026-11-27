import "../css/bar.css";
import type { MouseEvent, ReactNode } from "react";
import { Check, Circle, X } from "lucide-react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Text } from "@astryxdesign/core/Text";
import type { PortfolioData } from "@/app/(app)/portfolio/load";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import { Button } from "@/components/ui/Button";
import { DEFAULT_THEME } from "@/lib/portfolio-themes";
import type { PortfolioEditorApi } from "../runtime";

export { writeStripHidden } from "./strip-cookie";

/*
 * The first-run strip's words, its steps and how it is drawn, with no hooks and no state, so the
 * loading view (StandIn.tsx, in the gate's own chunk) can draw the same strip, inert, where the
 * editor's strip will be: nothing moves when the editor arrives. FirstRun.tsx keeps the state (which
 * step is shown, Skip, Hide) and passes it in. Decision 0031, "A new student"; 0033, G5.
 */

/** What the strip knows to tick its items. */
export type Facts = { name: boolean; headline: boolean; photo: boolean; look: boolean; exhbt: boolean };

/** `go` is given the strip's button that was pressed: what opens a sheet passes it to `open`, which gives the focus back to it. */
type Item = { id: keyof Facts; label: string; optional?: boolean; go(api: PortfolioEditorApi, pressed?: HTMLElement): void };
export type StripStep = { id: string; label: string; description: string; lead: string; items: Item[]; done(f: Facts): boolean; action?: { label: string; go(api: PortfolioEditorApi): void } };

/** Scrolls to where the first exhbt goes: the band that says "Your best project goes here", else the Add tile. */
function toFirstExhbt(): void {
  const root = document.querySelector<HTMLElement>('[data-editor="portfolio"][data-ready]');
  const at = root?.querySelector<HTMLElement>("#best-work-h") ?? root?.querySelector<HTMLElement>("[data-add-tile], [data-owner]");
  if (!at) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  at.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
  const button = at.closest("section, header, [data-owner]")?.querySelector<HTMLElement>("a[href], button") ?? null;
  (button ?? at).focus?.({ preventScroll: true });
}

/** The strip's words and steps, in one place. */
export const STRIP = {
  title: "Your portfolio in three steps",
  lead: "This is your own page, as employers will see it. Type straight onto it.",
  skip: "Skip to your first exhbt",
  hide: "Hide this",
  next: "Next",
  steps: [
    {
      // A true head start: signing up was the first step, so the strip starts one in (decision 0033, G5).
      id: "account",
      label: "Account",
      description: "Done",
      lead: "Your account is ready. Next, your page.",
      items: [],
      done: () => true,
    },
    {
      id: "page",
      label: "Your page",
      description: "About a minute",
      lead: "Who you are, in a line or two.",
      items: [
        { id: "name", label: "Your name", go: (api) => api.jumpTo("profile.name") },
        { id: "headline", label: "One line about you", go: (api) => api.jumpTo("profile.headline") },
        { id: "photo", label: "A photo", optional: true, go: (api, pressed) => api.open("photo", pressed) },
        { id: "look", label: "Pick a look", go: (api, pressed) => api.open("look", pressed) },
      ],
      done: (f) => f.name && f.headline && f.look,
    },
    {
      id: "exhbt",
      label: "Your first exhbt",
      description: "A project, written up",
      lead: "An exhbt is a short write-up of one project: what you did, how, and the result it got. It goes on your page, with a link of its own to send.",
      items: [],
      done: (f) => f.exhbt,
      action: { label: "Show me where it goes", go: () => toFirstExhbt() },
    },
  ] as StripStep[],
};

/**
 * The facts from the loader's data and the edited state. `lookChosen` is what only the editor knows: the
 * Look menu opened this visit, or the look changed since it opened. A look other than the default counts.
 */
export function factsOf(data: PortfolioData, now: { name: string; headline: string; themeId: string }, lookChosen = false): Facts {
  return {
    name: now.name.trim().length > 0,
    headline: now.headline.trim().length > 0,
    photo: Boolean(data.builder.photoUrl),
    look: lookChosen || now.themeId !== DEFAULT_THEME.id,
    exhbt: data.builder.projects.length + data.builder.drafts.length + data.ownerOnly.length > 0,
  };
}

/** The step shown when the person has not picked one: the first not done, or the last after Skip. */
export function stepShown(facts: Facts, skipped = false): number {
  const steps = STRIP.steps;
  return skipped ? steps.length - 1 : Math.max(0, steps.findIndex((s) => !s.done(facts)));
}

export const allDone = (facts: Facts) => STRIP.steps.every((s) => s.done(facts));

type Handlers = { api: PortfolioEditorApi; hide(): void; skip(): void; view(step: number): void };

/**
 * The strip as drawn. With no `on` it is the loading view's copy: the same boxes, nothing to press.
 * `narrow` is the one-line strip (a window under 48rem); `size` the bar's control size (md under a finger).
 */
export function StripView({ facts, current, narrow, size, on }: { facts: Facts; current: number; narrow: boolean; size: "sm" | "md"; on?: Handlers }): ReactNode {
  const steps = STRIP.steps;
  const step = steps[current]!;
  const press = (run: (h: Handlers, pressed: HTMLElement) => void) => (on ? (e: MouseEvent) => run(on, e.currentTarget as HTMLElement) : undefined);
  const hideButton = <IconButton label={STRIP.hide} tooltip={STRIP.hide} variant="ghost" size={size} icon={<X aria-hidden size={18} />} onClick={press((h) => h.hide())} />;

  if (narrow) {
    const next = step.items.find((i) => !facts[i.id]);
    const go = (h: Handlers, pressed: HTMLElement) => (next ? next.go(h.api, pressed) : step.action ? step.action.go(h.api) : h.view(Math.min(steps.length - 1, current + 1)));
    return (
      <section className="pe-first" aria-label={STRIP.title} data-first-run={on ? "narrow" : undefined} data-step={step.id}>
        <div className="pe-first-head">
          <Text type="body" weight="semibold" className="pe-first-line">
            {`Step ${current + 1} of ${steps.length}: ${step.label}`}
          </Text>
          <span className="pe-first-actions">
            <Button size={size} onClick={press(go)} label={next ? `${STRIP.next}: ${next.label}` : step.action ? `${STRIP.next}: ${step.action.label}` : STRIP.next}>
              {STRIP.next}
            </Button>
            {hideButton}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="pe-first" aria-labelledby={on ? "pe-first-h" : undefined} data-first-run={on ? "wide" : undefined} data-step={step.id}>
      <div className="pe-first-head">
        <div>
          <h2 id={on ? "pe-first-h" : undefined} className="pe-first-title">
            {STRIP.title}
          </h2>
          <Text type="body" color="secondary" className="pe-first-lead">
            {STRIP.lead}
          </Text>
        </div>
        <span className="pe-first-actions">
          {current < steps.length - 1 && (
            <Button size={size} onClick={press((h) => h.skip())}>
              {STRIP.skip}
            </Button>
          )}
          {hideButton}
        </span>
      </div>
      <div className="pe-first-body">
        <div className="pe-first-steps">
          <Stepper activeStep={current} label={STRIP.title} density="compact" onStepClick={on ? (i) => on.view(i) : undefined}>
            {steps.map((s, i) => (
              <Step key={s.id} step={i} label={s.label} description={s.description} indicator={s.done(facts) ? "auto" : "number"} status={s.done(facts) ? "success" : undefined} data-strip-step={s.id} data-done={s.done(facts) ? "true" : undefined} />
            ))}
          </Stepper>
        </div>
        <div className="pe-first-now">
          <Text type="body" className="pe-first-lead">
            {step.lead}
          </Text>
          {step.items.length > 0 && (
            <ul className="pe-first-todo">
              {step.items.map((item) => {
                const done = facts[item.id];
                return (
                  <li key={item.id} data-todo={item.id} data-done={done ? "true" : undefined}>
                    <Button size={size} onClick={press((h, pressed) => item.go(h.api, pressed))} label={`${item.label}${item.optional ? " (optional)" : ""}${done ? ", done" : ""}`}>
                      {done ? <Check aria-hidden size={16} strokeWidth={2.75} className="pe-first-tick" /> : <Circle aria-hidden size={16} strokeWidth={2} className="pe-first-open" />}
                      {item.label}
                      {item.optional && <span className="pe-first-optional">optional</span>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {step.action && (
            <span>
              <Button size={size} onClick={press((h) => step.action!.go(h.api))}>
                {step.action.label}
              </Button>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The strip as the loading view draws it (StandIn.tsx, under the empty bar): the strip the editor will
 * draw first, inert and hidden from assistive technology. The server knows neither the window's width
 * nor the pointer, so each of the four is drawn and CSS shows the one that applies (css/bar.css). Draws
 * nothing when the editor's strip would not show, "Hide this" included (STRIP_COOKIE, read by the server).
 */
export function StripStandIn({ data, state }: { data: PortfolioData; state: BuilderState }): ReactNode {
  if (data.stripHidden) return null;
  const facts = factsOf(data, { name: state.profile.name, headline: state.profile.headline, themeId: state.arrangement.themeId });
  if (allDone(facts)) return null;
  const current = stepShown(facts);
  return (
    <div aria-hidden inert className="pe-first-standin" data-first-run-stand-in="">
      {(["wide-sm", "wide-md", "narrow-sm", "narrow-md"] as const).map((v) => (
        <div key={v} data-variant={v}>
          <StripView facts={facts} current={current} narrow={v.startsWith("narrow")} size={v.endsWith("md") ? "md" : "sm"} />
        </div>
      ))}
    </div>
  );
}
