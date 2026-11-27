"use client";

import type { CSSProperties, ReactNode } from "react";
import { Lock } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { fontFamily } from "@/components/portfolio/themeFonts";
import { Button } from "@/components/ui/Button";
import { FONTS, PORTFOLIO_THEMES, themeById, variantsOf, DEFAULT_THEME, type LookId, type PortfolioTheme } from "@/lib/portfolio-themes";
import { usePortfolioApi, usePortfolioData, usePortfolioState, usePortfolioUi } from "../runtime";

/*
 * The Look menu (decision 0031, "What is edited where": Look and colourway). A list, not pictures: the
 * page behind it is the preview. Each look by name, its two faces named in their own type, the look in
 * brief as three dots of its colours, and for a locked look the plan it comes with. The shown look's
 * colourways sit under it as swatches to pick.
 *
 * An open look applies at once (`change`, with an Undo step) and the page restyles behind the menu. A
 * locked look is only previewed (`previewLook`), with a line under the bar saying so; it is never saved
 * and never in "See as a visitor". The look menu is Astryx's RadioList; the swatches are the one part
 * Astryx has no control for, so they are plain radios drawn with its tokens (css/bar.css).
 */

/** What the swatches under a look are called, as the step builder words them. */
const SWATCH_LABEL: Partial<Record<LookId, string>> = { classic: "Your accent", studio: "Your colour", bloom: "Your pastel" };

/** A look's full name with its colourway, as Undo and the preview line say it. */
export const lookName = (t: PortfolioTheme) => (t.variant ? `${t.name}, ${t.variant.name}` : t.name);

/** The look shown on the page now: the one being previewed, else the saved one. */
function useShown(): PortfolioTheme {
  const saved = usePortfolioState((s) => s.arrangement.themeId);
  const previewing = usePortfolioUi((u) => u.previewing);
  return themeById(previewing ?? saved) ?? DEFAULT_THEME;
}

/** Picks a look (or a colourway): applies it when the plan has it, previews it when not. */
function usePick(): (t: PortfolioTheme) => void {
  const api = usePortfolioApi();
  const { locks } = usePortfolioData().builder;
  const saved = usePortfolioState((s) => s.arrangement.themeId);
  return (t) => {
    if (locks[t.look]) {
      api.previewLook(t.id);
      api.say(`Previewing ${lookName(t)}. It comes with ${locks[t.look]!.planName}, and is not saved.`);
      return;
    }
    api.previewLook(null);
    if (t.id === saved) return;
    api.change((s) => ({ ...s, arrangement: { ...s.arrangement, themeId: t.id } }), `changed the look to ${lookName(t)}`);
  };
}

/** The menu's contents: the same in the bar's popover and, on a narrow window, in a sheet. */
export function LookPanel(): ReactNode {
  const { locks, savedButLocked } = usePortfolioData().builder;
  const shown = useShown();
  const pick = usePick();

  return (
    <div className="pe-look" data-look-menu>
      <Text type="body" color="secondary" className="pe-look-lead">
        Colours, type and layout. Your words and exhbts stay the same in every look, on your portfolio and on each exhbt.
      </Text>
      {savedButLocked && (
        <Banner
          status="info"
          title={`Your saved look, ${savedButLocked}, comes with a plan you are not on now`}
          description="Your portfolio shows the default until you are back on it, then it returns."
          data-testid="look-held"
        />
      )}
      <RadioList
        label="Looks"
        isLabelHidden
        value={shown.look}
        onChange={(look) => {
          const base = PORTFOLIO_THEMES.find((t) => t.look === look);
          if (base) pick(base);
        }}
      >
        {PORTFOLIO_THEMES.map((base) => {
          const lock = locks[base.look];
          const on = shown.look === base.look;
          const t = on ? shown : base;
          const variants = variantsOf(base.look);
          return (
            <RadioListItem
              key={base.look}
              value={base.look}
              align="start"
              data-look-option={base.look}
              data-locked={lock ? "true" : undefined}
              label={
                <span className="pe-look-name">
                  {base.name}
                  {lock && (
                    <span className="pe-look-lock" aria-hidden>
                      <Lock size={12} strokeWidth={2.5} />
                      {lock.planName}
                    </span>
                  )}
                  {lock && <span className="sr-only">(comes with {lock.planName})</span>}
                </span>
              }
              description={
                <>
                  <Faces theme={base} />
                  <span className="pe-look-blurb">{base.blurb}</span>
                  {on && variants.length > 1 && <Colourways look={base.look} shown={t} variants={variants} onPick={pick} />}
                </>
              }
              endContent={<Dots theme={t} />}
            />
          );
        })}
      </RadioList>
    </div>
  );
}

/** The look's two faces, each named in its own type. */
function Faces({ theme }: { theme: PortfolioTheme }): ReactNode {
  const { display, body } = theme.type;
  // A look's faces are its data: drawn in their own family, which no token holds.
  const face = (k: typeof display) => (
    <span className="pe-look-face" style={{ fontFamily: fontFamily(k) }}>
      {FONTS[k].label}
    </span>
  );
  return (
    <span className="pe-look-faces">
      {face(display)}
      {body !== display && <> and {face(body)}</>}
    </span>
  );
}

/** The look in brief: its signature surface, its text and its accent, as three dots. Decorative. */
function Dots({ theme }: { theme: PortfolioTheme }): ReactNode {
  return (
    <span aria-hidden className="pe-look-dots">
      {[theme.bg, theme.text, theme.accent].map((c, i) => (
        <span key={i} className="pe-look-dot" style={{ "--pe-dot": c } as CSSProperties} />
      ))}
    </span>
  );
}

/** A look's colourways, as swatches to pick (radios, one name for the group). */
function Colourways({ look, shown, variants, onPick }: { look: LookId; shown: PortfolioTheme; variants: PortfolioTheme[]; onPick: (t: PortfolioTheme) => void }): ReactNode {
  const name = SWATCH_LABEL[look] ?? "Colour";
  return (
    <fieldset className="pe-swatches" data-colourways={look}>
      <legend className="sr-only">{`${shown.name}: ${name}`}</legend>
      <span aria-hidden className="pe-swatches-label">
        {name}
      </span>
      {variants.map((v) => (
        <label key={v.id} className="pe-swatch" title={v.variant!.name} data-variant-option={v.id}>
          <input type="radio" name={`pe-colourway-${look}`} value={v.id} checked={shown.id === v.id} onChange={() => onPick(v)} />
          <span aria-hidden className="pe-swatch-dot" style={{ "--pe-dot": v.variant!.swatch } as CSSProperties} />
          <span className="sr-only">{v.variant!.name}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The line under the bar while a locked look is previewed: what it is, the plan it comes with, and the
 * two ways out. Nothing is saved while it shows.
 */
export function PreviewNotice(): ReactNode {
  const previewing = usePortfolioUi((u) => u.previewing);
  const { locks } = usePortfolioData().builder;
  const api = usePortfolioApi();
  const t = previewing ? themeById(previewing) : undefined;
  if (!t) return null;
  const lock = locks[t.look];
  return (
    <div data-look-preview={t.id}>
      <Banner
        status="info"
        container="section"
        title={lock ? `Preview of ${lookName(t)}, comes with ${lock.planName}` : `Preview of ${lookName(t)}`}
        description="Only you see this preview. It is not saved, and visitors see your own look."
        endContent={
          <span className="pe-bar-end">
            <Button href="/account/billing" size="sm">
              See plans
            </Button>
            <Button size="sm" onClick={() => api.previewLook(null)}>
              Back to yours
            </Button>
          </span>
        }
      />
    </div>
  );
}
