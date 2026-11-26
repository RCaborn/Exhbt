import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { demoExhbts, demoHomeProjects, demoOwner, demoPortfolio, type DemoExhbt } from "@/lib/exhbt";
import { portfolioHost, portfolioUrl } from "@/lib/hosts";
import type { SectionKey } from "@/lib/portfolio-layout";
import { DEFAULT_THEME, PORTFOLIO_THEMES, type LookId, type PortfolioTheme } from "@/lib/portfolio-themes";

/**
 * The lab's sample data: the made-up person the /demo page uses (Amara Okafor, lib/exhbt.ts) and
 * the eight looks. No sign-in, no database and no AI: everything here is a constant. Wherever she
 * shows, say she is made up.
 */
export const sample = {
  owner: demoOwner,
  person: demoPortfolio.person,
  firstName: demoOwner.name.split(" ")[0]!,
  /** Her exhbts, in her portfolio's order. The first is the one Home pictures. */
  exhbts: demoExhbts,
  /** Her address: amara.exhbt.co.uk. */
  address: portfolioHost(demoOwner.username),
  /** One exhbt's address: amara.exhbt.co.uk/gp-reminders. */
  exhbtAddress: (slug: string) => portfolioUrl(demoOwner.username, slug),
  /** The eight looks, each in its first colourway. */
  looks: PORTFOLIO_THEMES,
} as const;

/** A look by its name ("night", "studio"...), in its first colourway. The Exhbt look when it isn't one. */
export const lookOf = (look?: LookId | null): PortfolioTheme => PORTFOLIO_THEMES.find((t) => t.look === look) ?? DEFAULT_THEME;

/** One of her exhbts by its slug. The first when it isn't one. */
export const exhbtOf = (slug?: string | null): DemoExhbt => demoExhbts.find((e) => e.slug === slug) ?? demoExhbts[0]!;

/**
 * One of her exhbts, drawn by the real exhbt page (ProjectView) in a look, as a visitor sees it.
 * Put it in a `Frame`. `checked={false}` draws it before it has been published: the "checked"
 * tick is hollow, as it is on a draft.
 */
export function SampleExhbt({
  slug,
  look,
  checked = true,
  headingLevel = "h2",
  className = "p-4 sm:p-6 lg:p-8",
}: {
  slug?: string;
  look?: LookId;
  checked?: boolean;
  headingLevel?: "h1" | "h2";
  /** On the page's ground: its padding inside the frame. */
  className?: string;
}) {
  const e = exhbtOf(slug);
  const theme = lookOf(look);
  return (
    <div {...lookAttrs(theme)} style={themeStyle(theme)} className={`bg-[var(--pf-ground)] text-[color:var(--pf-ink)] ${className}`}>
      <ProjectView
        doc={e.doc}
        owner={{ name: demoOwner.name, photoUrl: null, bio: demoOwner.headline, homeHref: "/demo" }}
        evidenceUrl="#"
        checkedOn={checked ? e.checkedOn : undefined}
        headingLevel={headingLevel}
      />
    </div>
  );
}

/**
 * Her portfolio's home page, drawn by the real one (PortfolioHome) in a look. Put it in a `Frame`.
 * `sections` chooses what is under the top of the page: by default her best work only, as Home
 * shows it; pass `sectionsAll` for the whole page.
 */
export function SamplePortfolio({ look, sections = ["featured"] }: { look?: LookId; sections?: SectionKey[] }) {
  return (
    <PortfolioHome person={demoPortfolio.person} theme={lookOf(look)} projects={demoHomeProjects()} featuredId={null} sections={sections} tiles={demoPortfolio.tiles} />
  );
}

/** Every section of her page, in her order. */
export const sectionsAll: SectionKey[] = demoPortfolio.sections;
