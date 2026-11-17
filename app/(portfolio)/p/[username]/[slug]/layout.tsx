import { headers } from "next/headers";
import { MadeWith } from "@/components/brand/MadeWith";
import { MARKETING_HOST, parseHost } from "@/lib/hosts";
import { jobLinkFor } from "@/lib/job-link-request";

/**
 * The frame around a single project (and a per-job page): a column on mist with the "made with
 * exhbt" sign-off at the foot. A per-job page (decision 0008) skips it. It was the whole portfolio's layout until the home page went edge to
 * edge (decision 0016); it is unchanged here.
 */
export default async function ProjectFrame({ children, params }: { children: React.ReactNode; params: Promise<{ username: string; slug: string }> }) {
  // A per-job page draws its own page in the person's look, edge to edge, with its own sign-off: no frame.
  const { username, slug } = await params;
  if (await jobLinkFor(username, slug)) return <>{children}</>;
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
