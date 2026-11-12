import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { getCurrentUser } from "@/lib/auth";
import { fileIdsOf } from "@/components/editor/media";
import { ENTITLEMENTS } from "@/lib/entitlements";
import { signedFileUrl } from "@/lib/files";
import { parseHost, portfolioHost } from "@/lib/hosts";
import { canPublish, getPlan } from "@/lib/plan";
import { mediaFor } from "@/lib/portfolio";
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

  return (
    <Editor
      id={record.id}
      initialDoc={record.doc}
      status={record.status}
      slug={record.slug}
      liveBase={liveBase}
      owner={{ name: profile.name?.trim() || profile.username || user.email.split("@")[0]!, photoUrl: await signedFileUrl(profile.photoFileId) }}
      imageUrls={imageUrls}
      fileEvidenceUrl={record.doc.evidence?.kind === "file" ? evidenceUrl : null}
      planBlock={verdict.ok ? null : verdict.reason}
      updatedAt={record.updatedAt}
      canGoLive={ENTITLEMENTS[plan].publicPortfolio}
      maxFileMb={ENTITLEMENTS[plan].uploadMbPerFile}
      liveFileIds={record.status === "published" && record.published ? fileIdsOf(record.published) : []}
    />
  );
}
