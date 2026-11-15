"use client";

import { Lock } from "lucide-react";
import { headingFamily } from "@/components/portfolio/themeFonts";
import type { Plan } from "@/lib/entitlements";
import { PORTFOLIO_THEMES } from "@/lib/portfolio-themes";

/** Why a look is locked for this person, and which plan opens it (from canUseTheme on the server). */
export type ThemeLock = { reason: string; upgradeTo?: Plan; planName: string };

/**
 * A compact strip of the looks (lib/portfolio-themes.ts): a small band each, as a radio group, so
 * the arrow keys move between them. Choosing one changes the preview at once. A look the plan
 * doesn't have still previews and shows a lock; the page then shows the usual upgrade prompt and
 * saves nothing (the server checks the plan again).
 */
export function ThemeStrip({
  picked,
  locks,
  onPick,
  ready,
}: {
  picked: string;
  locks: Record<string, ThemeLock>;
  onPick: (id: string) => void;
  ready: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-[1.0625rem] font-semibold">Look</legend>
      <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3">
        {PORTFOLIO_THEMES.map((t) => {
          const locked = locks[t.id];
          return (
            <label key={t.id} className="group relative block w-[5.5rem] cursor-pointer" data-theme-option={t.id} data-locked={locked ? "true" : undefined}>
              <input
                type="radio"
                name="look"
                value={t.id}
                checked={picked === t.id}
                onChange={() => onPick(t.id)}
                disabled={!ready}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative flex h-11 items-center gap-1.5 overflow-hidden rounded-[10px] border border-line px-2"
                style={{ background: t.bg, color: t.text }}
              >
                <span
                  className={`inline-flex size-6 shrink-0 items-center justify-center text-[0.6rem] font-semibold ${t.photo === "round" ? "rounded-full" : "rounded-[6px]"}`}
                  style={{ background: t.initials.bg, color: t.initials.text }}
                >
                  AO
                </span>
                <span className="truncate text-[0.95rem] leading-none font-semibold" style={{ fontFamily: headingFamily(t) }}>
                  Aa
                </span>
                {locked && (
                  <span className="absolute top-1 right-1 inline-flex size-4 items-center justify-center rounded-full" style={{ background: t.text, color: t.bg }}>
                    <Lock size={9} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="mt-1 block truncate text-[0.8125rem] font-semibold">
                {t.name}
                {locked && <span className="sr-only"> (locked: comes with {locked.planName})</span>}
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-11 rounded-[10px] outline-offset-2 peer-checked:outline peer-checked:outline-[3px] peer-checked:outline-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-jade"
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
