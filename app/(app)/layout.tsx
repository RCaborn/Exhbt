import { AppShell } from "@astryxdesign/core/AppShell";
import { SiteTopNav } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getCurrentUser } from "@/lib/auth";
import { portfolioServed } from "@/lib/portfolio-kind-server";
import { isPhase2Enabled } from "@/lib/site";

/**
 * App pages read the session here so the header can show a signed-in person their own links.
 * (Marketing pages keep the static header; reading the session makes these pages dynamic,
 * which most of them are already.)
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const phase2 = isPhase2Enabled();
  const portfolio = await portfolioServed();
  return (
    <>
      {/* The frame, as the marketing layout has it (components/site/shell.css). */}
      <AppShell
        height="auto"
        contentPadding={0}
        variant="surface"
        mobileNav={false}
        className="site-shell"
        topNav={<SiteTopNav signedIn={Boolean(user)} phase2={phase2} portfolio={portfolio} />}
      >
        <div id="main" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </AppShell>
      <SiteFooter />
    </>
  );
}
