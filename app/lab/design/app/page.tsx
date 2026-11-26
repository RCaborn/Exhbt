import { AppLab } from "@/components/lab/app/AppLab";
import type { FirstRunArt } from "@/components/lab/app/FirstRun";
import { isAppScreen, isAppShow } from "@/components/lab/app/screens";
import type { WorkArt } from "@/components/lab/app/WithWork";
import { appWords } from "@/components/lab/app/words";
import { PersonPage } from "@/components/lab/LabFrame";
import { Address, exhbtOf, lookOf, SampleExhbt } from "@/components/lab/samples";
import { labGate, labMetadata } from "@/components/lab/server";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { PortfolioHome, ProjectCard } from "@/components/portfolio/PortfolioHome";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { demoPortfolio } from "@/lib/exhbt";
import { homeProject } from "@/lib/portfolio-home";
import "@/components/lab/app/app.css";

export const generateMetadata = labMetadata("App");

/** Her page at each point of her first run, drawn by the real PortfolioHome in the default look. */
function firstRunArt(words: ReturnType<typeof appWords>): FirstRunArt {
  const theme = lookOf();
  // A new account: no address yet (Free), so the page carries no address chip; her name only.
  const bare: PortfolioPerson = { username: null, name: words.person.name, headline: null, bio: null, location: null, lookingFor: null, photoUrl: null };
  const filled: PortfolioPerson = { ...demoPortfolio.person, username: null };
  const first = exhbtOf(words.firstRun.exampleSlug);
  // Her first exhbt on her page is a draft, so it sits in her work as a card: the band would say "checked".
  const work = [homeProject(first.slug, first.doc, null)];
  const page = (person: PortfolioPerson, withWork: boolean) => (
    <PortfolioHome person={person} theme={theme} projects={withWork ? work : []} featuredId={null} sections={withWork ? ["work"] : []} tiles={{}} mode="preview" />
  );
  return {
    pages: { "00": page(bare, false), "10": page(filled, false), "01": page(bare, true), "11": page(filled, true) },
    example: <SampleExhbt slug={first.slug} className="p-8" />,
  };
}

/**
 * Her four exhbts: each one's card, as her portfolio draws it, and its page. The first is the one
 * in her page's band, so on a wide window its tile is her band itself (PortfolioHome, that section
 * only), as visitors see it at the top of her work.
 */
function workArt(words: ReturnType<typeof appWords>): WorkArt {
  const theme = lookOf();
  const cards: WorkArt["cards"] = {};
  const pages: WorkArt["pages"] = {};
  for (const t of words.work.tiles) {
    const e = exhbtOf(t.slug);
    const project = homeProject(e.slug, e.doc, null);
    cards[t.slug] = (
      <PersonPage className="app-tile-page">
        <div {...lookAttrs(theme)} style={themeStyle(theme)} className="h-full bg-[var(--pf-ground)] text-[color:var(--pf-ink)]">
          <ProjectCard project={project} />
        </div>
      </PersonPage>
    );
    pages[t.slug] = <SampleExhbt slug={t.slug} checked={t.status === "live"} className="p-4 sm:p-8 lg:p-10" />;
  }
  const first = words.work.tiles[0]!;
  const lead = exhbtOf(first.slug);
  const band = (
    <PersonPage className="app-tile-page">
      <PortfolioHome
        person={{ ...demoPortfolio.person }}
        theme={theme}
        projects={[homeProject(lead.slug, lead.doc, null)]}
        featuredId={null}
        sections={["featured"]}
        tiles={{}}
        sectionsOnly
      />
    </PersonPage>
  );
  return { cards, pages, band: { slug: first.slug, node: band }, radius: theme.shape.radius };
}

/**
 * The App screen (/lab/design/app): the frame every signed-in page would share, and three ordinary
 * screens in it, chosen by ?screen= (first-run, work, account). ?show= adds a feedback state:
 * copied or saved (a toast), failed (the inline banner), loading (the screen's skeleton).
 *
 * Every fact the screen states comes from where the product keeps it (components/lab/app/words.ts),
 * and the person's own pages are drawn here, on the server, by the real components.
 */
export default async function LabApp({ searchParams }: { searchParams: Promise<{ screen?: string | string[]; show?: string | string[] }> }) {
  labGate();
  const asked = await searchParams;
  const screen = isAppScreen(asked.screen) ? asked.screen : "first-run";
  const show = isAppShow(asked.show) ? asked.show : null;
  const words = appWords();
  return (
    <AppLab
      key={screen}
      screen={screen}
      show={show}
      words={words}
      address={<Address name={words.person.username} />}
      firstRun={screen === "first-run" ? firstRunArt(words) : undefined}
      work={screen === "work" ? workArt(words) : undefined}
    />
  );
}
