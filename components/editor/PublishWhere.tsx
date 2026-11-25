import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { portfolioAddress } from "@/lib/exhbt/publish-words";
import { portfolioHost } from "@/lib/hosts";

/*
 * What the publish step says about the portfolio, in both editors. Rory and Alex, 25 Nov 2026, found it unclear what
 * publishing does: "Am I publishing this one exhbt, or my portfolio?" Publishing puts one exhbt on the person's
 * portfolio, at a link of its own; these say so before and after. Both editors show them only where the plan has a
 * public portfolio (canGoLive), so "your portfolio" is always one the person has. An exhbt they have hidden from the
 * portfolio's home page (decision 0014) is still live at its own link, and the words say that instead. The words
 * after publishing are liveLine in lib/exhbt/publish-words.ts.
 */

/** Before publishing: where the exhbt goes, at the portfolio's address (`liveBase`); with no username yet, where exhbts go once there is one. */
export function WhereItGoes({ liveBase, hidden, className }: { liveBase: string | null; hidden: boolean; className?: string }) {
  if (!liveBase) {
    return (
      <p className={className}>
        Your exhbts go on your own portfolio, at {portfolioHost("yourname")}. You need a username to publish.{" "}
        <Link href="/account/portfolio" className="link font-semibold text-ink">
          Choose one
        </Link>
      </p>
    );
  }
  const at = (
    <a href={liveBase} className="link font-semibold">
      {portfolioAddress(liveBase)}
    </a>
  );
  return hidden ? (
    <p className={className} data-testid="where-it-goes">
      Publishing puts this exhbt live at its own link on {at}, to send with applications. You&apos;ve hidden it from your portfolio&apos;s home page, so it isn&apos;t listed there.
    </p>
  ) : (
    <p className={className} data-testid="where-it-goes">
      Publishing puts this exhbt on your portfolio at {at}, with its own link to send with applications.
    </p>
  );
}

/** After publishing: the button to the portfolio's home page. */
export function SeeYourPortfolio({ liveBase }: { liveBase: string }) {
  return (
    <Button href={liveBase} label="See your portfolio">
      See your portfolio
    </Button>
  );
}
