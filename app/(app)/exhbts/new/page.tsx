import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { getCurrentUser } from "@/lib/auth";
import { draftVerdict } from "@/lib/drafting";
import { isPhase2Enabled } from "@/lib/site";
import { DraftForm } from "./DraftForm";

export const metadata: Metadata = { title: "Draft an exhbt", robots: { index: false } };
/** Phase 2 is switched on at runtime (EXHBT_PHASE2), so this page must never be prerendered as a 404. */
export const dynamic = "force-dynamic";

/**
 * Upload → AI draft (docs/phase-2.md section 6). Files are read in the browser and uploaded
 * straight to Storage; the draft is made on the server and opens in the editor.
 */
export default async function NewExhbtPage() {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/exhbts/new");
  const v = await draftVerdict(user.id);

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <div className="mx-auto max-w-[40rem]">
        <div className="rounded-[24px] border border-line bg-surface p-6 shadow-pack sm:p-10">
          <h1 className="text-[2rem] sm:text-[2.6rem]">Draft an exhbt</h1>
          <p className="mt-3 text-graphite">Add your project files and a few notes. We draft it from them; you check every word.</p>
          <p className="mt-4 text-sm text-graphite" id="allowance">
            {v.left} of {v.perPeriod} AI {v.perPeriod === 1 ? "draft" : "drafts"} left · files up to {v.uploadMbPerFile} MB each
          </p>
          {v.ok ? (
            <DraftForm maxFileMb={v.uploadMbPerFile} />
          ) : (
            <UpgradePrompt reason={v.reason} upgradeTo={v.upgradeTo} tone="alert" className="mt-6" />
          )}
        </div>
      </div>
    </div>
  );
}
