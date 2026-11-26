import type { Metadata } from "next";
import Link from "next/link";
import { LinkForm } from "./LinkForm";
import { safeNext } from "@/lib/auth";
import { landingAfterSignIn } from "@/lib/landing";
import { portfolioKindForEveryone } from "@/lib/portfolio-kind-server";
import { isPhase2Enabled } from "@/lib/site";

export const metadata: Metadata = { title: "Email me a link", robots: { index: false } };

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext, landingAfterSignIn("log-in", await portfolioKindForEveryone(), isPhase2Enabled()));
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Email me a link</h1>
      <p className="mt-3 text-graphite">We&rsquo;ll email you a link that logs you in. No password needed.</p>
      <div className="mt-8">
        <LinkForm next={next} />
      </div>
      <p className="hint mt-8">
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="link">Back to log in</Link>
      </p>
    </div>
  );
}
