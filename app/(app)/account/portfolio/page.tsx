import { redirect } from "next/navigation";
import { portfolioServed } from "@/lib/portfolio-kind-server";

/**
 * Portfolio settings became the "You" step of the portfolio builder (decision 0016). Portfolio first
 * (decision 0031), its only callers are the "choose a username" links, so it opens the address sheet.
 */
export default async function PortfolioSettingsMoved() {
  redirect((await portfolioServed()) === "page" ? "/portfolio?open=address" : "/portfolio?step=you");
}
