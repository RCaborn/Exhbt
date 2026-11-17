import { redirect } from "next/navigation";

/** Portfolio settings became the "You" step of the portfolio builder (decision 0016). */
export default function PortfolioSettingsMoved() {
  redirect("/portfolio?step=you");
}
