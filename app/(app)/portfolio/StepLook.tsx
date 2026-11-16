"use client";

/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import { Lock } from "lucide-react";
import { headingFamily } from "@/components/portfolio/themeFonts";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { initialsOf } from "@/lib/portfolio-profile";
import { HEADING_FACES, PORTFOLIO_THEMES, type PortfolioTheme } from "@/lib/portfolio-themes";
import type { ThemeLock } from "./steps";

/**
 * Step 2, Your look (decision 0012): every look as a small page with the person's own name, photo
 * and headline in it, as a radio group (arrow keys move between looks, the big preview follows).
 * A look the plan doesn't have still previews, shows a lock and the upgrade offer, and isn't saved;
 * the server checks the plan again on every save.
 */
export function StepLook({
  picked,
  onPick,
  locks,
  savedButLocked,
  person,
  ready,
}: {
  picked: string;
  onPick: (id: string) => void;
  locks: Record<string, ThemeLock>;
  savedButLocked: string | null;
  person: { name: string; headline: string; photoUrl: string | null };
  ready: boolean;
}) {
  const lock = locks[picked];
  return (
    <div>
      <p className="text-graphite">Colours, the heading font and the shape of your photo. Your words and projects stay the same in every look.</p>
      {savedButLocked && (
        <p className="mt-4 text-graphite" data-testid="look-held">
          Your saved look, {savedButLocked}, comes with a plan you&rsquo;re not on now. Your portfolio shows the default until you&rsquo;re back on it, then it returns.
        </p>
      )}
      {lock && <UpgradePrompt className="mt-4" reason={lock.reason} upgradeTo={lock.upgradeTo} primary={false} />}

      <div role="radiogroup" aria-labelledby="step-heading" className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5">
        {PORTFOLIO_THEMES.map((t) => {
          const locked = locks[t.id];
          return (
            <label key={t.id} className="group relative block cursor-pointer" data-theme-option={t.id} data-locked={locked ? "true" : undefined}>
              <input type="radio" name="themeId" value={t.id} checked={picked === t.id} onChange={() => onPick(t.id)} disabled={!ready} className="peer sr-only" />
              <MiniPage theme={t} person={person} locked={Boolean(locked)} />
              <span className="mt-2 block text-sm font-semibold">
                {t.name}
                {locked && <span className="sr-only"> (locked: comes with {locked.planName})</span>}
              </span>
              <span className="block text-[0.8125rem] text-graphite">
                {HEADING_FACES[t.face].label}
                {locked && <span aria-hidden>, {locked.planName}</span>}
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/3] rounded-[14px] outline-offset-2 peer-checked:outline peer-checked:outline-[3px] peer-checked:outline-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-jade"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** A look drawn as a tiny page: the masthead in the look's colours and face, then two tile outlines. */
function MiniPage({ theme: t, person, locked }: { theme: PortfolioTheme; person: { name: string; headline: string; photoUrl: string | null }; locked: boolean }) {
  const shape = t.photo === "round" ? "rounded-full" : "rounded-[7px]";
  return (
    <span aria-hidden className="relative flex aspect-[4/3] flex-col overflow-hidden rounded-[14px] border border-line bg-mist">
      <span className="flex flex-1 items-start gap-2 px-3 pt-3" style={{ background: t.bg, color: t.text }}>
        {person.photoUrl ? (
          <img src={person.photoUrl} alt="" width={28} height={28} className={`size-7 shrink-0 object-cover ${shape}`} />
        ) : (
          <span className={`inline-flex size-7 shrink-0 items-center justify-center text-[0.65rem] font-semibold ${shape}`} style={{ background: t.initials.bg, color: t.initials.text }}>
            {initialsOf(person.name) || "?"}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[0.95rem] leading-tight font-semibold tracking-[-0.02em]" style={{ fontFamily: headingFamily(t) }}>
            {person.name}
          </span>
          {person.headline && (
            <span className="mt-0.5 block truncate text-[0.68rem]" style={{ color: t.soft }}>
              {person.headline}
            </span>
          )}
          <span className="mt-1.5 block h-1 w-16 rounded-full opacity-40" style={{ background: t.text }} />
          <span className="mt-1 block h-1 w-12 rounded-full opacity-40" style={{ background: t.text }} />
        </span>
      </span>
      <span className="grid h-[34%] grid-cols-2 gap-1.5 p-2">
        <span className="rounded-[5px] border border-line bg-surface" />
        <span className="rounded-[5px] border border-line bg-surface" />
      </span>
      {locked && (
        <span className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full" style={{ background: t.text, color: t.bg }}>
          <Lock size={12} strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}
