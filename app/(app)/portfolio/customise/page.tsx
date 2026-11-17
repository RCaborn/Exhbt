import { redirect } from "next/navigation";

/** The customiser became the "Projects" step of the portfolio builder (decision 0016). */
export default function CustomiseMoved() {
  redirect("/portfolio?step=projects");
}
