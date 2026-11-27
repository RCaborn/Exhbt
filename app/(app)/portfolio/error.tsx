"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@/components/ui/Button";
import { useServed } from "./served";

/**
 * `/portfolio`'s own error page (decision 0031, "The switch": the ways back): for what the one-page
 * editor's boundary cannot see, the page failing on the server. It says so and offers to load it again.
 * Only someone the one-page editor was served to (the switch at "page" and no `?builder=steps`) is also
 * offered the step builder for this visit: anyone already on the step builder would only be sent to the
 * same failing page.
 *
 * Both buttons load the page afresh. A client navigation that only changed the query would keep this
 * error page. What was saved is safe; a change still waiting to be sent (the half-second after a key)
 * may not be, and the words say so.
 */
export default function PortfolioError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const served = useServed();
  const stepsAsked = useSearchParams().get("builder") === "steps";
  const editorServed = served === "page" && !stepsAsked;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" data-portfolio-error data-served={editorServed ? "page" : "steps"}>
      <Banner
        status="error"
        role="alert"
        title="Something went wrong opening your portfolio"
        description={
          editorServed
            ? "What you saved is safe, but a change from the last moment may not have been saved. Load the page again, or use the step builder for now."
            : "What you saved is safe, but a change from the last moment may not have been saved. Load the page again to carry on."
        }
        endContent={
          <span className="flex flex-wrap gap-2">
            <Button size="sm" variant={editorServed ? "secondary" : "primary"} onClick={() => window.location.reload()}>
              Load it again
            </Button>
            {editorServed && (
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
