import { Fraunces, Inter_Tight, Space_Grotesk } from "next/font/google";
import type { HeadingFace, PortfolioTheme } from "@/lib/portfolio-themes";

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

/** Sets what the band and the headings under it read: `--font-display` and the band colours. */
export function themeStyle(t: PortfolioTheme): React.CSSProperties {
  return {
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
