import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { STRIP_COOKIE, stripHiddenFor } from "@/components/portfolio-editor/bar/strip-cookie";
import { PortfolioGate } from "@/components/portfolio-editor/PortfolioGate";
import { TeamPanel } from "@/components/team/TeamPanel";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { portfolioKind, portfolioServed } from "@/lib/portfolio-kind-server";
import { isPhase2Enabled } from "@/lib/site";
import { Builder } from "./Builder";
import { JobLinksSection } from "./JobLinksSection";
import { loadPortfolioData } from "./load";
import { isStep, type Step } from "./steps";
import { TryNewPortfolio } from "./TryNewPortfolio";

type Search = { crash?: string; step?: string; builder?: string; joined?: string; left?: string; full?: string };

/** The address's own word for the step builder: the escape, and where the editor's crash fallback reloads to. */
const stepsAsked = (q: Search) => q.builder === "steps";

/** The tab's title follows the builder served: "Your portfolio" for the page itself, the step builder's own otherwise. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const page = !stepsAsked(await searchParams) && (await portfolioServed()) === "page";
  return { title: page ? "Your portfolio" : "Build your portfolio", robots: { index: false } };
}
// Per person, and EXHBT_PHASE2 is read at request time: never prerender (it would bake in the 404).
export const dynamic = "force-dynamic";

/**
 * A person's portfolio, to build (decisions 0016 and 0031). One switch decides which builder they get
 * (lib/portfolio-kind.ts):
 *  - "steps", today's for everyone: one guided flow in four steps, You, Your look, Your projects and
 *    Publish, with a live preview beside it (Builder.tsx), and the job links under it;
 *  - "page": the page itself, edited where it sits, in their look (components/portfolio-editor).
 * `?builder=steps` serves the step builder for this request whatever the switch says. This page only
 * loads (load.ts gives both builders the same data); every change goes through the checks in actions.ts.
 */
export default async function BuildPortfolioPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/portfolio");
  const asked = await searchParams;
  // Development only: the page failing on the server, for its error page's test (e2e/portfolio-safety.spec.ts).
  if (process.env.NODE_ENV !== "production" && asked.crash === "server") throw new Error("The portfolio page was told to fail (?crash=server, development only).");
  const admin = await isAdmin(user);
  const kind = stepsAsked(asked) ? "steps" : await portfolioKind(admin);
  const host = await headers().then((h) => h.get("x-forwarded-host") ?? h.get("host"));
  // The step builder reads only what it always read; the editor's own parts are loaded only for the editor.
  const data = await loadPortfolioData(user.id, host, admin, { editor: kind === "page" });

  if (kind === "steps") {
    const step: Step = isStep(asked.step) ? asked.step : "you";
    return (
      <>
        {admin && <TryNewPortfolio />}
        <Builder step={step} {...data.builder} />
        <JobLinksSection userId={user.id} />
      </>
    );
  }

  // The editor is drawn in the browser, inside the gate's boundary. The two panels it shows that keep
  // their own server actions are drawn here and handed in: the team's (TeamPanel) and the job links (the
  // compact menu). `joined`, `left` and `full` are the team's notes after a join, a leave or a refused
  // Make my own; the editor's Address keeps them in the address until the Team sheet closes, so a refresh
  // meanwhile draws the panel with them still.
  const said = asked.joined ? "joined" : asked.left ? "left" : null;
  // "Hide this" on the first-run strip, read here so neither the loading view nor the editor draws it.
  const stripHidden = stripHiddenFor((await cookies()).get(STRIP_COOKIE)?.value, user.id);
  return (
    <PortfolioGate
      data={{ ...data, stripHidden }}
      team={<TeamPanel userId={user.id} host={host} said={said} full={asked.full === "1"} />}
      jobLinks={<JobLinksSection compact userId={user.id} />}
    />
  );
}
