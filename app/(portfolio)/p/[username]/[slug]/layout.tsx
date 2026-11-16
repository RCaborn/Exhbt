import { headers } from "next/headers";
import { MadeWith } from "@/components/brand/MadeWith";
import { lookAttrs, printStyle, themeStyle } from "@/components/portfolio/themeFonts";
import { MARKETING_HOST, parseHost } from "@/lib/hosts";
import { portfolioLook } from "@/lib/portfolio";

/**
 * The frame around a single exhbt: a column on the person's look, with the "made with exhbt"
 * sign-off at the foot. The look's variables sit here (decision 0018), so the page ground, the
 * exhbt, the previous and next cards and the sign-off all take them.
 */
export default async function ProjectFrame({ children, params }: { children: React.ReactNode; params: Promise<{ username: string }> }) {
  // On alex.exhbt.co.uk a relative "/start" would stay on the portfolio host; send people to our site.
  const onPortfolioHost = parseHost((await headers()).get("host")).kind === "portfolio";
  const theme = await portfolioLook((await params).username);
  const paper = printStyle(theme);
  return (
    <div {...lookAttrs(theme)} style={themeStyle(theme)} className="min-h-svh bg-[var(--pf-ground)] text-[color:var(--pf-ink)]">
      {paper && <style>{paper}</style>}
      <main id="main" className="mx-auto max-w-[64rem] px-4 pt-8 pb-10 sm:px-8 sm:pt-12">
        {children}
      </main>
      <div className="mx-auto max-w-[64rem] px-4 pb-12 sm:px-8">
        <MadeWith startHref={onPortfolioHost ? `https://${MARKETING_HOST}/start` : "/start"} />
      </div>
    </div>
  );
}
