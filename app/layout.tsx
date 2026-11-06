import type { Metadata } from "next";
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-400-italic.css";
import "@fontsource/schibsted-grotesk/latin-400.css";
import "@fontsource/schibsted-grotesk/latin-500.css";
import "@fontsource/schibsted-grotesk/latin-600.css";
import "@fontsource/schibsted-grotesk/latin-700.css";
import "@fontsource/schibsted-grotesk/latin-800.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./globals.css";
import { isPrivatePreview } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "Exhbt: evidence employers can check", template: "%s · Exhbt" },
  description:
    "A free skills-gap roadmap for graduates, then a portfolio of short, checked exhbts of your project work that hiring managers can read in 30 seconds.",
  // Private preview: keep every page out of search results (see lib/site.ts).
  ...(isPrivatePreview ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {isPrivatePreview && (
          <p role="note" className="bg-ink px-4 py-1.5 text-center text-[0.8rem] font-medium text-white">
            Private preview. Exhbt isn&rsquo;t public yet, so please don&rsquo;t share this link widely.
          </p>
        )}
        {children}
      </body>
    </html>
  );
}
