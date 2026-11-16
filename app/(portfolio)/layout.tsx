import { headers } from "next/headers";
import { MadeWith } from "@/components/brand/MadeWith";
import { MARKETING_HOST, parseHost } from "@/lib/hosts";

/**
 * A person's public portfolio (alex.exhbt.co.uk, routed here by middleware.ts). No site
 * header: it's their page, not ours. Just the small "made with exhbt" sign-off at the foot.
 */
export default async function PortfolioLayout({ children }: { children: React.ReactNode }) {
  // On alex.exhbt.co.uk a relative "/start" would stay on the portfolio host; send people to our site.
  const onPortfolioHost = parseHost((await headers()).get("host")).kind === "portfolio";
  return (
    <div className="min-h-svh bg-mist">
      <main id="main" className="mx-auto max-w-[64rem] px-4 pt-8 pb-10 sm:px-8 sm:pt-12">
        {children}
      </main>
      <div className="mx-auto max-w-[64rem] px-4 pb-12 sm:px-8">
        <MadeWith startHref={onPortfolioHost ? `https://${MARKETING_HOST}/start` : "/start"} />
      </div>
    </div>
  );
}
