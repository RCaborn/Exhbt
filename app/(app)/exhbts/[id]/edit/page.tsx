import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { getCurrentUser } from "@/lib/auth";
import { loadAiVersion, loadDraftSource } from "@/lib/draft-tools";
import { signedFileUrl } from "@/lib/files";
import { parseHost, portfolioHost } from "@/lib/hosts";
import { canPublish, getPlan } from "@/lib/plan";
import { mediaFor } from "@/lib/portfolio";
import { rewriteAllowance } from "@/lib/rewriting";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Edit exhbt", robots: { index: false } };

type Params = { params: Promise<{ id: string }> };

/** The exhbt editor (docs/phase-2.md section 6). Only the owner sees it; anyone else gets a 404. */
export default async function EditExhbtPage({ params }: Params) {
  if (!isPhase2Enabled()) notFound();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exhbts/${id}/edit`)}`);
  const store = getStore();
  const record = await store.getExhbt(id);
  if (!record || record.userId !== user.id) notFound();

  const [profile, plan, all] = await Promise.all([store.getPortfolioProfile(user.id), getPlan(user.id), store.listExhbts(user.id)]);
  const verdict = canPublish(plan, all, id);
  const { imageUrls, evidenceUrl } = await mediaFor(record.doc);
  // Production shows the real address (alex.exhbt.co.uk); development and previews serve portfolios at /p/alex.
  const onAppHost = parseHost((await headers()).get("host")).kind === "app";
  const liveBase = profile.username ? (onAppHost ? `https://${portfolioHost(profile.username)}` : `/p/${profile.username}`) : null;

  // Rewrite and "Back to the AI version" need the source text kept from the draft.
  const hasSource = (await loadDraftSource(user.id, id)) !== null;
  const allowance = await rewriteAllowance(user.id, id);
  const aiVersion = hasSource ? await loadAiVersion(user.id, id) : null;

  return (
    <Editor
      draftTools={hasSource && aiVersion ? { aiVersion, rewritesLeft: allowance.left, rewritesLimit: allowance.limit } : null}
      id={record.id}
      initialDoc={record.doc}
      status={record.status}
      slug={record.slug}
      liveBase={liveBase}
      owner={{ name: profile.name?.trim() || profile.username || user.email.split("@")[0]!, photoUrl: await signedFileUrl(profile.photoFileId) }}
      imageUrls={imageUrls}
      fileEvidenceUrl={record.doc.evidence?.kind === "file" ? evidenceUrl : null}
      planBlock={verdict.ok ? null : verdict.reason}
    />
  );
}
