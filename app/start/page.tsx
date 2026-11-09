import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/site/SiteHeader";
import { StartForm } from "@/components/home/StartForm";

export const metadata: Metadata = {
  title: "Get your roadmap",
  // Ads and direct links land here; it shouldn't compete with the home page in search.
  robots: { index: false, follow: false },
};

/**
 * Search-only landing page for directed traffic (ads, social, QR codes): just the
 * job field and the button. Not in the main navigation; linked quietly from the footer.
 * Submits to /roadmap/new?role=… (the builder then starts at step 2) and carries utm_*.
 */
export default async function Start({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const utm = Object.fromEntries(
    Object.entries(params)
      .filter(([k, v]) => k.startsWith("utm_") && v)
      .map(([k, v]) => [k, String(v).slice(0, 100)]),
  );

  return (
    <div className="flex min-h-[calc(100svh-2rem)] flex-col bg-mist">
      <header className="px-4 py-5 sm:px-8">
        <Wordmark />
      </header>
      <main id="main" className="flex flex-1 items-center px-4 pb-16 sm:px-8">
        <div className="mx-auto w-full max-w-[44rem]">
          <h1 className="">What job do you want?</h1>
          <div className="mt-8">
            <StartForm id="start-direct" hidden={utm} />
          </div>
        </div>
      </main>
      <footer className="px-4 py-5 text-sm text-graphite sm:px-8">
        <Link href="/legal/privacy" className="link">Privacy</Link>
        <span aria-hidden> · </span>
        <Link href="/legal/terms" className="link">Terms</Link>
      </footer>
    </div>
  );
}
