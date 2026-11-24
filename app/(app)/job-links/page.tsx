import { notFound, redirect } from "next/navigation";
import { isPhase2Enabled } from "@/lib/site";

/** Job links are a section of the portfolio page. Old addresses land there. */
export default function JobLinksPage() {
  if (!isPhase2Enabled()) notFound();
  redirect("/portfolio#job-links");
}
