import { CHECKS_GUIDE } from "@/components/brand/Seal";
import { TeamByline } from "@/components/portfolio/TeamByline";
import { checkedOnLabel } from "@/lib/checked-on";
import { MARKETING_HOST } from "@/lib/hosts";
import type { PageEditorProps } from "./context";

/*
 * What the public page draws round the exhbt besides the doc: Save as PDF, the date beside the checks,
 * the checks link and the team byline. "See as a visitor" draws them as the public page does; the
 * editing page and the loading stand-in draw the same, inert, so the three are one page box for box
 * (decision 0026). Written once here so the three get the same words. No hooks: StandIn.tsx is in the
 * gate's own chunk.
 */

/** Whether the page is opened on the person's own host (alex.exhbt.co.uk), where the guide is on our site. */
export const onPortfolioHost = (env: Pick<PageEditorProps, "liveBase">) => Boolean(env.liveBase?.startsWith("https://"));

/**
 * ProjectView's props for those parts. `publishedAt` is when the exhbt was last published (useLive, which
 * follows a publish made on this page), or null: an exhbt never published says "Checked when published",
 * with the empty mark, as its checks have not run.
 */
export function visitorParts(env: Pick<PageEditorProps, "liveBase" | "team">, publishedAt: string | null | undefined) {
  return {
    saveAsPdf: true,
    checkedOn: checkedOnLabel(publishedAt),
    checksHref: onPortfolioHost(env) ? `https://${MARKETING_HOST}${CHECKS_GUIDE}` : undefined,
    team: env.team && env.team.length > 0 ? <TeamByline team={env.team} /> : undefined,
  };
}
