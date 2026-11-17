import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { MatchPrompt } from "@/components/team/MatchPrompt";
import { getCurrentUser } from "@/lib/auth";
import { draftVerdict } from "@/lib/drafting";
import { signedFileUrl } from "@/lib/files";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { canDraftInto, teamFilesFor } from "@/lib/team";
import { DraftForm, type PreloadFile } from "./DraftForm";

export const metadata: Metadata = { title: "Draft an exhbt", robots: { index: false } };
/** Phase 2 is switched on at runtime (EXHBT_PHASE2), so this page must never be prerendered as a 404. */
export const dynamic = "force-dynamic";

/**
 * Upload → AI draft (docs/phase-2.md section 6). Files are read in the browser and uploaded
 * straight to Storage; the draft is made on the server and opens in the editor.
 *
 * `?into=<id>`: a teammate drafting their own exhbt from a team project (decision 0013). The
 * project's files they were given are read in the browser like new ones, and the draft fills
 * that exhbt instead of starting another.
 */
export default async function NewExhbtPage({ searchParams }: { searchParams: Promise<{ into?: string }> }) {
  if (!isPhase2Enabled()) notFound();
  const { into: intoParam } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(intoParam ? `/exhbts/new?into=${intoParam}` : "/exhbts/new")}`);

  let into: string | undefined;
  const preload: PreloadFile[] = [];
  if (intoParam) {
    const target = await getStore().getExhbt(intoParam);
    const mine = target?.userId === user.id ? target.id : null;
    // Not theirs, already written in or live: their editor, or a fresh draft page.
    if (!canDraftInto(target, user.id)) redirect(mine ? `/exhbts/${mine}/edit` : "/exhbts/new");
    into = target.id;
    for (const f of await teamFilesFor(user.id, target.id)) {
      const url = await signedFileUrl(f.id, user.id);
      if (url) preload.push({ fileId: f.id, name: f.path.split("/").pop() ?? "file", mime: f.mime, url });
    }
  }
  const v = await draftVerdict(user.id, undefined, into);

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <MatchPrompt />
      <div className="mx-auto max-w-[40rem]">
        <div className="rounded-[24px] border border-line bg-surface p-6 shadow-pack sm:p-10">
          <h1 className="text-[2rem] sm:text-[2.6rem]">Draft an exhbt</h1>
          <p className="mt-3 text-graphite">
            {into
              ? "Your team's project files are below. Add your own files and notes about your part; we draft your exhbt from them, and you check every word."
              : "Add your project files and a few notes. We draft it from them; you check every word."}
          </p>
          <p className="mt-4 text-sm text-graphite" id="allowance">
            {v.left} of {v.perPeriod} AI {v.perPeriod === 1 ? "draft" : "drafts"} left · files up to {v.uploadMbPerFile} MB each
          </p>
          {v.ok ? (
            <DraftForm maxFileMb={v.uploadMbPerFile} into={into} preload={preload} />
          ) : (
            <UpgradePrompt reason={v.reason} upgradeTo={v.upgradeTo} tone="alert" className="mt-6" />
          )}
        </div>
      </div>
    </div>
  );
}
