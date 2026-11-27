import type { ReactNode } from "react";
import { portfolioServed } from "@/lib/portfolio-kind-server";
import { ServedProvider } from "./served";

/**
 * Tells `/portfolio`'s error page which builder the switch serves (portfolioServed, the same reading the app's
 * nav makes), so it offers the step builder only to someone the editor was served to. It adds nothing to the
 * page's markup.
 */
export default async function PortfolioLayout({ children }: { children: ReactNode }) {
  return <ServedProvider kind={await portfolioServed()}>{children}</ServedProvider>;
}
