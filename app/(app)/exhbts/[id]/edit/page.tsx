import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Editor, type EditorProps } from "@/components/editor/Editor";
import type { PageEditorProps } from "@/components/exhbt-editor/context";
import { EditorGate } from "@/components/exhbt-editor/EditorGate";
import { MatchPrompt } from "@/components/team/MatchPrompt";
import { TeamStrip } from "@/components/team/TeamStrip";
import { getCurrentUser } from "@/lib/auth";
import { fileIdsOf } from "@/components/editor/media";
import { isAdmin } from "@/lib/admin";
import { editorKind } from "@/lib/editor-kind-server";
import { TryNewEditor } from "./TryNewEditor";
import { ENTITLEMENTS } from "@/lib/entitlements";
import { imagesOf } from "@/lib/exhbt/blocks";
import { isFigureNews, isLayoutReason } from "@/lib/exhbt/drafted";
import { isFormat } from "@/lib/exhbt/formats";
import { isDraftHelperFile, loadAiVersion, loadDraftSource } from "@/lib/draft-tools";
import { signedFileUrl } from "@/lib/files";
import { parseHost, portfolioHost } from "@/lib/hosts";
import { canPublish, getPlan } from "@/lib/plan";
import { mediaFor, portfolioLook } from "@/lib/portfolio";
import { themeFor } from "@/lib/portfolio-themes";
import { rewriteAllowance } from "@/lib/rewriting";
import { teamFor } from "@/lib/team";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Edit exhbt", robots: { index: false } };

type Query = { skipped?: string; drafted?: string; why?: string; fig?: string; editor?: string; crash?: string };
type Params = { params: Promise<{ id: string }>; searchParams: Promise<Query> };

/**
 * The exhbt editor (docs/phase-2.md section 6). Only the owner sees it; anyone else gets a 404.
 *
 * Which editor it serves is the switch's to say (lib/editor-kind.ts, decision 0026): the classic one
 * for everyone until the edit-on-page editor is switched on (DEFAULT_EDITOR, or the runtime variable
 * EXHBT_EDITOR for everyone with no deploy), and an admin's own choice before either. An address that
 * asks for the classic editor (`?editor=classic`, for this visit: the new editor's menu and its crash
 * fallback open it so) gets it whatever the switch says.
 * The new editor is drawn only in the browser, behind a crash fallback (EditorGate). If this page
 * itself fails on the server, the route's error page (error.tsx) links to the classic editor.
 */
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
  // Development only: the page fails on the server, for the route's error page (e2e/editor-classic.spec.ts).
  if (process.env.NODE_ENV !== "production" && query.crash === "server") throw new Error("The edit page was told to fail (?crash=server, development only).");

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

  const editorProps: EditorProps = {
    draftTools: hasSource && aiVersion ? { aiVersion, rewritesLeft: allowance.left, rewritesLimit: allowance.limit } : null,
    id: record.id,
    drafted,
    // The store reads every doc into the current shape (sections, graph kinds; decision 0015).
    initialDoc: record.doc,
    status: record.status,
    slug: record.slug,
    liveBase,
    owner: { name: profile.name?.trim() || profile.username || user.email.split("@")[0]!, photoUrl: await signedFileUrl(profile.photoFileId, user.id), bio: profile.headline },
    imageUrls,
    figureSources,
    fileEvidenceUrl: record.doc.evidence?.kind === "file" ? evidenceUrl : null,
    planBlock: verdict.ok ? null : { reason: verdict.reason, upgradeTo: verdict.upgradeTo },
    updatedAt: record.updatedAt,
    canGoLive: ENTITLEMENTS[plan].publicPortfolio,
    maxFileMb: ENTITLEMENTS[plan].uploadMbPerFile,
    liveFileIds: record.status === "published" && record.published ? fileIdsOf(record.published) : [],
  };

  // Which editor: the classic one when the address asks for it, or when the switch says so for this person
  // (an admin's own choice first, then what everyone gets). Whether they are an admin is read on every request.
  const asked = query.editor === "classic";
  const admin = await isAdmin(user);
  const kind = await editorKind(admin);

  return (
    <>
    {/* Teammates and the file-match prompt sit outside the editor (decision 0013). */}
    <TeamStrip exhbt={record} userId={user.id} skipped={skipped} />
    <MatchPrompt />
    {asked || kind === "classic" ? (
      <div data-editor="classic">
        {/* The way back, when this visit asked for the classic editor and the new one is on. A full page load, so the classic editor's unsaved-changes check runs. */}
        {asked && kind === "page" && (
          <div className="bg-mist">
            <p className="mx-auto max-w-[78rem] px-4 pt-6 text-sm sm:px-8 xl:max-w-[90rem]">
              You&apos;re in the classic editor.{" "}
              <a href={`/exhbts/${record.id}/edit`} className="link font-semibold">
                Back to the new editor
              </a>
            </p>
          </div>
        )}
        {/* An admin whose editor is the classic one: the way to the new one, and nobody else is sent it. */}
        {admin && kind === "classic" && <TryNewEditor id={record.id} />}
        {/* The way to the new editor, said beside a layout only it can edit, and only to a person who may use it: one whose editor it is (this visit asked for the classic one), or an admin who can switch it on. */}
        <Editor {...editorProps} newEditor={kind === "page" ? "visit" : admin ? "switch" : undefined} />
      </div>
    ) : (
      <EditorGate
        {...editorProps}
        // An admin's "Use the classic editor" is stored as their choice; everyone else's is for the visit.
        adminSwitch={admin}
        // The look the person's public pages use (as app/(portfolio)/p/[username]/[slug]/layout.tsx gets it); with no username yet, the one their plan allows.
        theme={profile.username ? await portfolioLook(profile.username) : themeFor(profile, plan)}
        reportFiles={await reportFilesOf(user.id, record.id)}
        // What "See as a visitor" draws as the public page does: the team byline and the date beside the checks.
        team={await teamFor(record, onAppHost && profile.username ? portfolioHost(profile.username) : (await headers()).get("host"))}
        publishedAt={record.publishedAt}
      />
    )}
    </>
  );
}

/**
 * The person's stored PDFs attached to this exhbt (the reports a draft was made from: the draft route
 * attaches its uploads), each with a signed link, for "Take a figure from my report". The draft's own
 * helper files (its source text and AI version) are left out. `name` is the stored file's last path
 * segment, the upload's name made safe (lib/uploads.ts). An exhbt started from scratch has none.
 */
async function reportFilesOf(userId: string, exhbtId: string): Promise<PageEditorProps["reportFiles"]> {
  const pdfs = (await getStore().listFiles(userId, exhbtId)).filter((f) => f.kind === "source" && f.mime === "application/pdf" && !isDraftHelperFile(f));
  const linked = await Promise.all(pdfs.map(async (f) => ({ fileId: f.id, name: f.path.split("/").pop() || "report.pdf", url: await signedFileUrl(f.id, userId) })));
  return linked.flatMap((f) => (f.url ? [{ fileId: f.fileId, name: f.name, url: f.url }] : []));
}
