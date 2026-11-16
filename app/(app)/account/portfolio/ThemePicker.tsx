"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Lock } from "lucide-react";
import { PortfolioHeader } from "@/components/exhbt/PortfolioHeader";
import { headingFamily } from "@/components/portfolio/themeFonts";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import type { Plan } from "@/lib/entitlements";
import { HEADING_FACES, PORTFOLIO_THEMES, themeById, type PortfolioTheme } from "@/lib/portfolio-themes";
import { useHydrated } from "@/lib/use-hydrated";
import { saveThemeAction, type ThemeState } from "./actions";

/** Why a look is locked for this person, and which plan opens it (from canUseTheme on the server). */
export type ThemeLock = { reason: string; upgradeTo?: Plan; planName: string };

/**
 * The portfolio look: a live preview of the band, then a grid of looks. The grid is a radio group
 * (arrow keys move between looks; the preview follows). A look the plan doesn't have still previews,
 * shows a lock and the upgrade offer, and can't be saved. Saving goes through saveThemeAction,
 * which checks the plan again.
 */
export function ThemePicker({
  current,
  locks,
  owner,
  savedButLocked,
}: {
  /** The look the portfolio shows now (the default when the stored choice isn't on the plan). */
  current: string;
  locks: Record<string, ThemeLock>;
  owner: { username: string; name: string; headline: string | null; bio: string | null; photoUrl: string | null };
  /** Name of a stored look the plan no longer has, so we can say it comes back. */
  savedButLocked: string | null;
}) {
  const [state, action] = useActionState<ThemeState, FormData>(saveThemeAction, undefined);
  const ready = useHydrated();
  const [picked, setPicked] = useState(current);
  const theme = themeById(picked) ?? PORTFOLIO_THEMES[0]!;
  const lock = locks[theme.id];
  const isCurrent = picked === current;

  return (
    <form action={action} data-ready={ready ? "true" : undefined} className="mt-5">
      <p className="mb-3 text-sm text-graphite">Preview</p>
      <div data-testid="theme-preview" data-preview-theme={theme.id}>
        <PortfolioHeader
          framed
          theme={theme}
          owner={{ username: owner.username, name: owner.name, headline: owner.headline, bio: owner.bio, photoUrl: owner.photoUrl }}
          exhbts={[]}
        />
      </div>

      <div role="radiogroup" aria-labelledby="look-heading" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PORTFOLIO_THEMES.map((t) => {
          const locked = locks[t.id];
          return (
            <label key={t.id} className="group relative block cursor-pointer" data-theme-option={t.id} data-locked={locked ? "true" : undefined}>
              <input
                type="radio"
                name="themeId"
                value={t.id}
                checked={picked === t.id}
                onChange={() => setPicked(t.id)}
                disabled={!ready}
                className="peer sr-only"
              />
              <Swatch theme={t} locked={Boolean(locked)} />
              <span className="mt-1.5 block text-sm font-semibold">
                {t.name}
                {locked && <span className="sr-only"> (locked: comes with {locked.planName})</span>}
              </span>
              <span className="block text-[0.8125rem] text-graphite">
                {HEADING_FACES[t.face].label}, {t.photo === "round" ? "round" : "square"} photo
                {locked && <span aria-hidden>, {locked.planName}</span>}
              </span>
              {/* The ring sits on the swatch when the hidden radio has focus or is chosen. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 aspect-[16/9] rounded-[14px] outline-offset-2 peer-checked:outline peer-checked:outline-[3px] peer-checked:outline-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-jade"
              />
            </label>
          );
        })}
      </div>

      {savedButLocked && (
        <p className="mt-4 text-graphite" data-testid="look-held">
          Your saved look, {savedButLocked}, comes with a plan you&rsquo;re not on now. Your portfolio shows the default until you&rsquo;re back on it, then it returns.
        </p>
      )}

      {lock && <UpgradePrompt className="mt-4" reason={lock.reason} upgradeTo={lock.upgradeTo} primary={false} />}

      {state?.error && !lock && (
        <p role="alert" className="mt-4 rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
          {state.error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {!lock && <Submit />}
        <p role="status" className="text-sm text-jade">{state?.saved && isCurrent ? "Saved." : ""}</p>
      </div>
    </form>
  );
}

/** A small band: the look's ground, its name set in its heading face, and the photo in its shape. */
function Swatch({ theme: t, locked }: { theme: PortfolioTheme; locked: boolean }) {
  return (
    <span
      aria-hidden
      className="relative flex aspect-[16/9] items-center gap-2.5 overflow-hidden rounded-[14px] border border-line px-3"
      style={{ background: t.bg, color: t.text }}
    >
      <span
        className={`inline-flex size-9 shrink-0 items-center justify-center text-[0.8rem] font-semibold ${t.photo === "round" ? "rounded-full" : "rounded-[9px]"}`}
        style={{ background: t.initials.bg, color: t.initials.text }}
      >
        AO
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[1.05rem] leading-tight font-semibold tracking-[-0.02em]" style={{ fontFamily: headingFamily(t) }}>
          Amara Okafor
        </span>
        <span className="block truncate text-[0.75rem]" style={{ color: t.soft }}>
          Data analyst
        </span>
      </span>
      {locked && (
        <span className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full" style={{ background: t.text, color: t.bg }}>
          <Lock size={12} strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} label="Save look">
      Save look
    </Button>
  );
}
