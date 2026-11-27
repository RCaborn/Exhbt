import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@/components/ui/Button";

/**
 * An admin's way from the step builder to the one-page portfolio editor (lib/portfolio-kind.ts; decision
 * 0031, "The admin trial"). `/portfolio` draws it only for a signed-in admin who is being served the
 * step builder, in a line above it. Nobody else is sent it.
 *
 * It is a plain form, so it works before the page's scripts have loaded, and the page loads afresh:
 * POST /api/portfolio/editor stores the choice in this browser and sends the browser back to
 * /portfolio, which then opens as the page itself, as it does from then on. The step builder's own
 * check for changes not yet saved runs, as it does for any other way off the page.
 */
export function TryNewPortfolio() {
  return (
    <form method="post" action="/api/portfolio/editor" data-admin-switch>
      <input type="hidden" name="kind" value="page" />
      <Banner
        status="info"
        container="section"
        title="Admins only: the new portfolio editor"
        description="Your portfolio itself, edited where it sits. It stays on in this browser, and “Use the step builder” in its menu brings you back."
        endContent={
          <Button type="submit" size="sm">
            Try the new portfolio
          </Button>
        }
      />
    </form>
  );
}
