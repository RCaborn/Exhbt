"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import { PortfolioHome, type HomeProps } from "@/components/portfolio/PortfolioHome";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { FONTS, PORTFOLIO_THEMES, themeById, variantsOf, type LookId, type PortfolioTheme } from "@/lib/portfolio-themes";
import type { ThemeLock } from "./steps";

/** What the swatches under a look are called, as Rory's spec words them. */
const SWATCH_LABEL: Partial<Record<LookId, string>> = { classic: "Your accent", studio: "Your colour", bloom: "Your pastel" };

/** The width a preview is drawn at before it is scaled down to its card: a laptop's page, so it shows the wide layout. */
const PAGE_WIDTH = 1120;

/**
 * Step 2, Your look (decisions 0016 and 0018): every look drawn as the top of the person's own
 * page (their name, photo, headline, intro and best piece of work), large, as a radio group. Arrow
 * keys move between looks and the big preview beside the steps follows at once. Classic, Studio and
 * Bloom have swatches for their colourways. A look the plan doesn't have still previews, says which
 * plan it comes with and shows the upgrade offer, and isn't saved; the server checks every save.
 */
export function StepLook({
  picked,
  onPick,
  locks,
  savedButLocked,
  page,
  ready,
}: {
  picked: string;
  onPick: (id: string) => void;
  /** By look id. */
  locks: Record<string, ThemeLock>;
  savedButLocked: string | null;
  /** The person's own page, as the live preview draws it. */
  page: Omit<HomeProps, "theme">;
  ready: boolean;
}) {
  const current = themeById(picked) ?? PORTFOLIO_THEMES[0]!;
  const lock = locks[current.look];
  return (
    <div>
      <p className="text-graphite">Colours, type and how the page is laid out. Your words and projects stay the same in every look, on your page and on every exhbt.</p>
      {savedButLocked && (
        <p className="mt-4 text-graphite" data-testid="look-held">
          Your saved look, {savedButLocked}, comes with a plan you&rsquo;re not on now. Your portfolio shows the default until you&rsquo;re back on it, then it returns.
        </p>
      )}
      {lock && <UpgradePrompt className="mt-4" reason={lock.reason} upgradeTo={lock.upgradeTo} primary={false} />}

      <div role="radiogroup" aria-labelledby="step-heading" className="mt-6 grid gap-y-8">
        {PORTFOLIO_THEMES.map((base) => {
          const locked = locks[base.look];
          const on = current.look === base.look;
          // The colourway shown: the picked one for the picked look, else the look's default.
          const shown = on ? current : base;
          const variants = variantsOf(base.look);
          return (
            <div key={base.look} data-look-card={base.look}>
              <label className="group relative block cursor-pointer" data-theme-option={base.id} data-locked={locked ? "true" : undefined}>
                <input type="radio" name="themeId" value={shown.id} checked={on} onChange={() => onPick(shown.id)} disabled={!ready} className="peer sr-only" />
                <PagePicture theme={shown} page={page} />
                {locked && (
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[0.8125rem] font-semibold text-white">
                    <Lock aria-hidden size={13} strokeWidth={2.5} /> {locked.planName}
                  </span>
                )}
                {on && (
                  <span aria-hidden className="absolute top-2.5 left-2.5 inline-flex size-7 items-center justify-center rounded-full bg-ink text-white">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 aspect-[16/10] rounded-[14px] outline-offset-[3px] peer-checked:outline peer-checked:outline-[3px] peer-checked:outline-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-jade"
                />
                <span className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[1.0625rem] font-semibold">
                    {base.name}
                    {locked && <span className="sr-only"> (locked: comes with {locked.planName})</span>}
                  </span>
                  <span className="text-[0.8125rem] text-graphite">
                    {FONTS[base.type.display].label}
                    {base.type.body !== base.type.display && ` and ${FONTS[base.type.body].label}`}
                  </span>
                </span>
                <span className="mt-0.5 block text-[0.9375rem] text-graphite">
                  {base.blurb} {base.suits}.
                </span>
              </label>
              {variants.length > 1 && (
                <div role="radiogroup" aria-label={`${base.name}: ${SWATCH_LABEL[base.look] ?? "Colour"}`} className="mt-3 flex flex-wrap items-center gap-2.5">
                  <span aria-hidden className="mr-1 text-[0.875rem] text-graphite">
                    {SWATCH_LABEL[base.look] ?? "Colour"}
                  </span>
                  {variants.map((v) => {
                    const checked = current.id === v.id;
                    return (
                      <label key={v.id} className="relative cursor-pointer" title={v.variant!.name} data-variant-option={v.id}>
                        <input type="radio" name={`colourway-${base.look}`} value={v.id} checked={checked} onChange={() => onPick(v.id)} disabled={!ready} className="peer sr-only" />
                        <span className="sr-only">{v.variant!.name}</span>
                        <span
                          aria-hidden
                          className={`block size-8 border border-black/15 outline-offset-2 peer-checked:outline peer-checked:outline-[3px] peer-checked:outline-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-jade ${
                            base.look === "studio" ? "rounded-[3px]" : "rounded-full"
                          }`}
                          style={{ background: v.variant!.swatch }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The top of the person's page in a look: drawn at a laptop's width (so it shows the wide layout,
 * which lays itself out by its container) and scaled down to the card. A picture: hidden from screen
 * readers, nothing in it takes focus. It draws only once it knows its size, so it never flashes the
 * phone layout.
 */
function PagePicture({ theme, page }: { theme: PortfolioTheme; page: Omit<HomeProps, "theme"> }) {
  const box = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / PAGE_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={box} aria-hidden className="relative block aspect-[16/10] overflow-hidden rounded-[14px] border border-line" style={{ background: theme.palette.ground }}>
      {scale > 0 && (
        <span inert className="pointer-events-none absolute top-0 left-0 block origin-top-left" style={{ width: PAGE_WIDTH, transform: `scale(${scale})` }}>
          <PortfolioHome {...page} theme={theme} mode="public" thumbnail inertChrome />
        </span>
      )}
    </span>
  );
}
