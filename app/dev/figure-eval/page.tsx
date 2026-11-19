import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/store";
import { FigureEval } from "./FigureEval";

export const metadata: Metadata = { title: "Figure eval", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Development only: the page the figure eval drives (evals/figure-pick/README.md, decision 0025).
 * It runs the draft page's own code on a PDF: the pages drawn in the browser, the choice of which
 * to send, the request to /api/exhbts/figure-pick, and the cut. Nothing is uploaded or saved.
 * Returns 404 in production and with Supabase configured, like the other /dev pages.
 */
export default function FigureEvalPage() {
  if (process.env.NODE_ENV === "production" || isSupabaseConfigured()) notFound();
  return (
    <main id="main" className="min-h-svh bg-mist px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[46rem]">
        <h1>Figure eval</h1>
        <p className="mt-2 text-graphite">
          For <code className="font-mono text-sm">npm run eval:figures</code>. It draws a PDF&rsquo;s pages as the draft page does, sends the ones that
          may hold a figure to the pick, and reports the answer. Sign in first; each pick counts against the signed-in person&rsquo;s allowance.
        </p>
        <FigureEval />
      </div>
    </main>
  );
}
