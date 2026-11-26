"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Circle, X } from "lucide-react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@/components/ui/Button";
import { DEFAULT_THEME } from "@/lib/portfolio-themes";
import { usePortfolioApi, usePortfolioData, usePortfolioState, usePortfolioUi, type PortfolioEditorApi } from "../runtime";
import { useBarSize, useNarrow } from "./hooks";

/*
 * The first minute (decision 0031, "A new student" and "Data": first run). Under the bar, in app chrome,
 * a strip that tells a stranger what this page is, what to do now and what comes next, in three steps:
 *   1. Account, done: signing up was the first step, so the strip starts one in (decision 0033, G5);
 *   2. Your page, about a minute: the name, a one-line headline, a photo (optional) and a look, each one
 *      going to its field or opening its menu, and ticked when done;
 *   3. Your first exhbt: it goes to the band ("Your best project goes here") or the Add tile.
 * "Skip to your first exhbt" is there from the start; "Hide this" is kept in the browser for this person
 * (localStorage, in try and catch: losing it only brings the strip back). It shows until both are done,
 * worked out from the data. On a narrow window it is one line, "Step 2 of 3", with Next.
 *
 * The steps, their words and what ticks them are data (STRIP, below), so a change of plan (decision
 * 0033) is a change to that table, not to the component. Astryx's Stepper draws the steps.
 */

/** What the strip knows to tick its items. */
type Facts = { name: boolean; headline: boolean; photo: boolean; look: boolean; exhbt: boolean };

type Item = { id: keyof Facts; label: string; optional?: boolean; go(api: PortfolioEditorApi): void };
type StripStep = { id: string; label: string; description: string; lead: string; items: Item[]; done(f: Facts): boolean; action?: { label: string; go(api: PortfolioEditorApi): void } };

/** Scrolls to where the first exhbt goes: the band that says "Your best project goes here", else the Add tile. */
function toFirstExhbt(): void {
  const root = document.querySelector<HTMLElement>('[data-editor="portfolio"]');
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
        { id: "photo", label: "A photo", optional: true, go: (api) => api.open("photo") },
        { id: "look", label: "Pick a look", go: (api) => api.open("look") },
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

const hiddenKey = (owner: string) => `exhbt:portfolio-first-run-hidden:${owner}`;

function readHidden(owner: string): boolean {
  try {
    return window.localStorage.getItem(hiddenKey(owner)) === "1";
  } catch {
    return false;
  }
}

function writeHidden(owner: string): void {
  try {
    window.localStorage.setItem(hiddenKey(owner), "1");
  } catch {
    // Kept for this visit only.
  }
}

export function FirstRun(): ReactNode {
  const api = usePortfolioApi();
  const data = usePortfolioData();
  const narrow = useNarrow();
  const size = useBarSize();
  const visitor = usePortfolioUi((u) => u.visitor);
  const name = usePortfolioState((s) => s.profile.name.trim().length > 0);
  const headline = usePortfolioState((s) => s.profile.headline.trim().length > 0);
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const [firstLook] = useState(themeId);
  // Opening the Look menu counts as choosing: on Free there is one look, and keeping it is a choice too.
  const lookOpen = usePortfolioUi((u) => u.sheet === "look");
  const [lookSeen, setLookSeen] = useState(false);
  useEffect(() => {
    if (lookOpen) setLookSeen(true);
  }, [lookOpen]);
  const [hidden, setHidden] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  // Read after the first paint: the server has no browser storage.
  useEffect(() => setHidden(readHidden(data.owner)), [data.owner]);

  const facts: Facts = {
    name,
    headline,
    photo: Boolean(data.builder.photoUrl),
    look: lookSeen || themeId !== firstLook || themeId !== DEFAULT_THEME.id,
    exhbt: data.builder.projects.length + data.builder.drafts.length + data.ownerOnly.length > 0,
  };
  const steps = STRIP.steps;
  const allDone = steps.every((s) => s.done(facts));
  if (hidden || allDone || visitor) return null;

  const firstOpen = steps.findIndex((s) => !s.done(facts));
  const current = viewing ?? (skipped ? steps.length - 1 : Math.max(0, firstOpen));
  const step = steps[current]!;

  const hide = () => {
    writeHidden(data.owner);
    setHidden(true);
    api.say("The steps are hidden. Everything they pointed to is on your page and in the bar.");
  };
  const skip = () => {
    setSkipped(true);
    setViewing(steps.length - 1);
  };

  const hideButton = <IconButton label={STRIP.hide} tooltip={STRIP.hide} variant="ghost" size={size} icon={<X aria-hidden size={18} />} onClick={hide} />;

  if (narrow) {
    const next = step.items.find((i) => !facts[i.id]);
    const go = () => (next ? next.go(api) : step.action ? step.action.go(api) : setViewing(Math.min(steps.length - 1, current + 1)));
    return (
      <section className="pe-first" aria-label={STRIP.title} data-first-run="narrow" data-step={step.id}>
        <div className="pe-first-head">
          <Text type="body" weight="semibold" className="pe-first-line">
            {`Step ${current + 1} of ${steps.length}: ${step.label}`}
          </Text>
          <span className="pe-first-actions">
            <Button size={size} onClick={go} label={next ? `${STRIP.next}: ${next.label}` : step.action ? `${STRIP.next}: ${step.action.label}` : STRIP.next}>
              {STRIP.next}
            </Button>
            {hideButton}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="pe-first" aria-labelledby="pe-first-h" data-first-run="wide" data-step={step.id}>
      <div className="pe-first-head">
        <div>
          <h2 id="pe-first-h" className="pe-first-title">
            {STRIP.title}
          </h2>
          <Text type="body" color="secondary" className="pe-first-lead">
            {STRIP.lead}
          </Text>
        </div>
        <span className="pe-first-actions">
          {current < steps.length - 1 && (
            <Button size={size} onClick={skip}>
              {STRIP.skip}
            </Button>
          )}
          {hideButton}
        </span>
      </div>
      <div className="pe-first-body">
        <div className="pe-first-steps">
          <Stepper activeStep={current} label={STRIP.title} density="compact" onStepClick={(i) => setViewing(i)}>
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
                    <Button size={size} onClick={() => item.go(api)} label={`${item.label}${item.optional ? " (optional)" : ""}${done ? ", done" : ""}`}>
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
              <Button size={size} onClick={() => step.action!.go(api)}>
                {step.action.label}
              </Button>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
