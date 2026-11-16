import { Fraunces, Inter_Tight, Space_Grotesk } from "next/font/google";
import { pageOf, type HeadingFace, type PortfolioTheme } from "@/lib/portfolio-themes";

/*
 * The heading faces a portfolio look can use besides Bricolage Grotesque (which the whole site
 * loads). Only the 600 weight, latin, with no preload: the browser downloads a file only when a
 * heading on the page uses it, so most visitors fetch none of these.
 */
// (next/font reads these options at build time, so each call spells them out.)
const interTight = Inter_Tight({ subsets: ["latin"], weight: "600", display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: "600", display: "swap", preload: false });
const fraunces = Fraunces({ subsets: ["latin"], weight: "600", style: "normal", display: "swap", preload: false });

const FAMILY: Record<HeadingFace, string> = {
  bricolage: '"Bricolage Grotesque Variable", "Inter", system-ui, sans-serif',
  "inter-tight": `${interTight.style.fontFamily}, "Inter", system-ui, sans-serif`,
  "space-grotesk": `${spaceGrotesk.style.fontFamily}, "Inter", system-ui, sans-serif`,
  fraunces: `${fraunces.style.fontFamily}, Georgia, serif`,
};

/** The CSS font-family for a theme's headings. */
export const headingFamily = (t: Pick<PortfolioTheme, "face">) => FAMILY[t.face];

/**
 * Sets what a portfolio's pages read, as CSS custom properties on a wrapper (decision 0016):
 *   --font-display                       the heading face
 *   --band-bg, -text, -soft, -accent, -edge, -initials-bg, -initials-text
 *                                        the one coloured surface (the featured band, the project bar)
 *   --pf-ground, -ink, -soft, -faint, -line, -card, -well, -button-bg, -button-text, -accent,
 *   --pf-radius, --pf-radius-lg          the page around it: ground, text, cards, corners, buttons
 * The portfolio home and its tiles use only these (no fixed brand colour classes), so a look can
 * restyle the whole page, and the exhbt pages can read the same names.
 */
export function themeStyle(t: PortfolioTheme): React.CSSProperties {
  const p = pageOf(t);
  return {
    "--pf-ground": p.ground,
    "--pf-ink": p.ink,
    "--pf-soft": p.soft,
    "--pf-faint": p.faint,
    "--pf-line": p.line,
    "--pf-card": p.card,
    "--pf-well": p.well,
    "--pf-button-bg": p.buttonBg,
    "--pf-button-text": p.buttonText,
    "--pf-accent": p.accent,
    "--pf-radius": p.radius,
    "--pf-radius-lg": p.radiusLarge,
    "--font-display": headingFamily(t),
    "--band-bg": t.bg,
    "--band-text": t.text,
    "--band-soft": t.soft,
    "--band-accent": t.accent,
    "--band-edge": t.edge,
    "--band-initials-bg": t.initials.bg,
    "--band-initials-text": t.initials.text,
  } as React.CSSProperties;
}
