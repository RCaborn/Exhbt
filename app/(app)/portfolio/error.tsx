"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@/components/ui/Button";

/**
 * `/portfolio`'s own error page (decision 0031, "The switch": the ways back): for what the one-page
 * editor's boundary cannot see, the page failing on the server. It says so and offers the step builder
 * for this visit. Where the step builder was already what the address asked for, there is nothing
 * further back to go to: it offers the page again.
 *
 * Both buttons load the page afresh. A client navigation that only changed the query would keep this
 * error page.
 */
export default function PortfolioError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const stepsAsked = useSearchParams().get("builder") === "steps";
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" data-portfolio-error>
      <Banner
        status="error"
        role="alert"
        title="Something went wrong opening your portfolio"
        description={stepsAsked ? "Nothing you saved is lost. Load the page again to carry on." : "Nothing you saved is lost. Load the page again, or use the step builder for now."}
        endContent={
          <span className="flex flex-wrap gap-2">
            <Button size="sm" variant={stepsAsked ? "primary" : "secondary"} onClick={() => window.location.reload()}>
              Load it again
            </Button>
            {!stepsAsked && (
              <Button size="sm" variant="primary" onClick={() => window.location.assign("/portfolio?builder=steps")}>
                Use the step builder
              </Button>
            )}
          </span>
        }
      />
    </div>
  );
}
