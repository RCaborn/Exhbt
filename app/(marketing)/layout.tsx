import type { Metadata } from "next";
import { AppShell } from "@astryxdesign/core/AppShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteTopNav } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SITE_ORIGIN, siteLd } from "@/lib/seo";

// Relative addresses in the marketing pages' metadata resolve against www. Portfolio pages sit in
// another route group and do not inherit this: they give absolute addresses on their own host.
export const metadata: Metadata = { metadataBase: new URL(SITE_ORIGIN) };

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Organization and WebSite describe the whole site, so they sit here and are on each marketing page. */}
      <JsonLd data={siteLd()} />
      {/* The frame (components/site/shell.css says what it changes in AppShell and why). */}
      <AppShell
        height="auto"
        contentPadding={0}
        variant="surface"
        mobileNav={false}
        className="site-shell"
        topNav={<SiteTopNav />}
      >
        <div id="main" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </AppShell>
      <SiteFooter />
    </>
  );
}
