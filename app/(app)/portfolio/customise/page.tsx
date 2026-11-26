import { redirect } from "next/navigation";
import { portfolioServed } from "@/lib/portfolio-kind-server";

/** The customiser became the "Projects" step of the portfolio builder (decision 0016); portfolio first (decision 0031), the portfolio itself. */
export default async function CustomiseMoved() {
  redirect((await portfolioServed()) === "page" ? "/portfolio" : "/portfolio?step=projects");
}
