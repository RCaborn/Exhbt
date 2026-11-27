import { notFound, redirect } from "next/navigation";
import { portfolioServed } from "@/lib/portfolio-kind-server";
import { isPhase2Enabled } from "@/lib/site";

/** Job links are a section of the portfolio page (portfolio first, a menu in its bar: decision 0031). Old addresses land there. */
export default async function JobLinksPage() {
  if (!isPhase2Enabled()) notFound();
  redirect((await portfolioServed()) === "page" ? "/portfolio?open=job-links" : "/portfolio#job-links");
}
