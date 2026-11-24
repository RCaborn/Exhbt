import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { MatchPrompt } from "@/components/team/MatchPrompt";
import { TeamStrip } from "@/components/team/TeamStrip";
import { getCurrentUser } from "@/lib/auth";
import { fileIdsOf } from "@/components/editor/media";
import { ENTITLEMENTS } from "@/lib/entitlements";
import { imagesOf } from "@/lib/exhbt/blocks";
import { isFigureNews, isLayoutReason } from "@/lib/exhbt/drafted";
import { isFormat } from "@/lib/exhbt/formats";
import { loadAiVersion, loadDraftSource } from "@/lib/draft-tools";
import { signedFileUrl } from "@/lib/files";
import { parseHost, portfolioHost } from "@/lib/hosts";
import { canPublish, getPlan } from "@/lib/plan";
import { mediaFor } from "@/lib/portfolio";
import { rewriteAllowance } from "@/lib/rewriting";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Edit exhbt", robots: { index: false } };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ skipped?: string; drafted?: string; why?: string; fig?: string }> };

/** The exhbt editor (docs/phase-2.md section 6). Only the owner sees it; anyone else gets a 404. */
export default async function EditExhbtPage({ params, searchParams }: Params) {
  if (!isPhase2Enabled()) notFound();
  const { id } = await params;
  // Files a teammate's plan couldn't hold when they made their own exhbt (lib/team.ts makeOwnExhbt).
  const query = await searchParams;
  const skipped = Math.max(0, Math.min(99, Number(query.skipped) || 0));
  // What the draft page passed on, said once in the editor (decisions 0024 and 0025): the layout the
  // AI chose, why, and what came of looking for a figure. Each is one of a fixed list, with fixed
  // wording (lib/exhbt/drafted.ts); anything else in the address is ignored.
  const drafted = isFormat(query.drafted)
    ? { format: query.drafted, ...(isLayoutReason(query.why) ? { reason: query.why } : {}), ...(isFigureNews(query.fig) ? { figure: query.fig } : {}) }
    : undefined;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exhbts/${id}/edit`)}`);
  const store = getStore();
  const record = await store.getExhbt(id);
  if (!record || record.userId !== user.id) notFound();

  const [profile, plan, all] = await Promise.all([store.getPortfolioProfile(user.id), getPlan(user.id), store.listExhbts(user.id)]);
  const verdict = canPublish(plan, all, id);
  const { imageUrls, evidenceUrl } = await mediaFor(record.doc, user.id);
  // The stored reports picked figures came from, so they can be cropped again or swapped for
  // another page (decision 0017). Only the person's own files get a link (signedFileUrl checks).
  const figureSources: Record<string, string | null> = {};
  for (const sourceId of new Set(imagesOf(record.doc).flatMap((im) => (im.picked?.sourceFileId ? [im.picked.sourceFileId] : [])))) {
    figureSources[sourceId] = await signedFileUrl(sourceId, user.id);
  }
  // Production shows the real address (alex.exhbt.co.uk); development and previews serve portfolios at /p/alex.
  const onAppHost = parseHost((await headers()).get("host")).kind === "app";
  const liveBase = profile.username ? (onAppHost ? `https://${portfolioHost(profile.username)}` : `/p/${profile.username}`) : null;

  // Rewrite and "Back to the AI version" need the source text kept from the draft.
  const hasSource = (await loadDraftSource(user.id, id)) !== null;
  const allowance = await rewriteAllowance(user.id, id);
  const aiVersion = hasSource ? await loadAiVersion(user.id, id) : null;

  return (
    <>
    {/* Teammates and the file-match prompt sit outside the editor (decision 0013). */}
    <TeamStrip exhbt={record} userId={user.id} skipped={skipped} />
    <MatchPrompt />
    <Editor
      draftTools={hasSource && aiVersion ? { aiVersion, rewritesLeft: allowance.left, rewritesLimit: allowance.limit } : null}
      id={record.id}
      drafted={drafted}
      // The store reads every doc into the current shape (sections, graph kinds; decision 0015).
      initialDoc={record.doc}
      status={record.status}
      slug={record.slug}
      liveBase={liveBase}
      owner={{ name: profile.name?.trim() || profile.username || user.email.split("@")[0]!, photoUrl: await signedFileUrl(profile.photoFileId, user.id), bio: profile.headline }}
      imageUrls={imageUrls}
      figureSources={figureSources}
      fileEvidenceUrl={record.doc.evidence?.kind === "file" ? evidenceUrl : null}
      planBlock={verdict.ok ? null : { reason: verdict.reason, upgradeTo: verdict.upgradeTo }}
      updatedAt={record.updatedAt}
      canGoLive={ENTITLEMENTS[plan].publicPortfolio}
      maxFileMb={ENTITLEMENTS[plan].uploadMbPerFile}
      liveFileIds={record.status === "published" && record.published ? fileIdsOf(record.published) : []}
    />
    </>
  );
}
