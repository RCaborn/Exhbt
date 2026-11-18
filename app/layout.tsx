import type { Metadata } from "next";
// globals.css first: it declares the cascade-layer order that Astryx and Tailwind share.
import "./globals.css";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import { Providers } from "./providers";
import { PageViewBeacon } from "@/components/site/PageViewBeacon";
import { MARKETING_HOST } from "@/lib/hosts";
import { isPrivatePreview } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${MARKETING_HOST}`),
  title: { default: "Exhbt: evidence employers can check", template: "%s · Exhbt" },
  description:
    "A free skills-gap roadmap for graduates, then your own portfolio site at name.exhbt.co.uk, built from short, checked exhbts of your project work.",
  // Private preview: keep every page out of search results (see lib/site.ts).
  ...(isPrivatePreview ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2"
          >
            Skip to content
          </a>
          {isPrivatePreview && (
            <p role="note" className="bg-ink px-4 py-1.5 text-center text-[0.8rem] font-medium text-white print:hidden">
              Private preview. Exhbt isn&rsquo;t public yet, so please don&rsquo;t share this link widely.
            </p>
          )}
          {children}
          <PageViewBeacon />
        </Providers>
      </body>
    </html>
  );
}
