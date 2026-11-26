import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { MatchPrompt } from "@/components/team/MatchPrompt";
import { ADD_EXHBT, addExhbtView, BUILD_IT_YOURSELF, DRAFT_WITH_AI } from "@/lib/add-exhbt";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { draftVerdict } from "@/lib/drafting";
import { editorKind } from "@/lib/editor-kind-server";
import { ENTITLEMENTS } from "@/lib/entitlements";
import { offeredIn } from "@/lib/exhbt/formats";
import { signedFileUrl } from "@/lib/files";
import { canCreateExhbt, canPublish, getPlan } from "@/lib/plan";
import { portfolioKind } from "@/lib/portfolio-kind-server";
import { portfolioHref } from "@/lib/portfolio-links";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { canDraftInto, teamFilesFor } from "@/lib/team";
import { Chooser, NoRoom, type Where } from "./Chooser";
import { DraftForm, type PreloadFile } from "./DraftForm";
import { LayoutGallery } from "./LayoutGallery";

type Query = { into?: string; start?: string; refused?: string };

const TITLES = { choose: "Add an exhbt", draft: "Draft an exhbt", blank: "Choose a layout" };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  return { title: TITLES[addExhbtView(await searchParams)], robots: { index: false } };
}
/** Phase 2 is switched on at runtime (EXHBT_PHASE2), so this page must never be prerendered as a 404. */
export const dynamic = "force-dynamic";

/**
 * "Add an exhbt": two ways to start, of equal weight (lib/add-exhbt.ts has the addresses).
 *  - Draft it from my files: the upload form (docs/phase-2.md section 6), as it always was.
 *  - Write it myself: the layouts the person's editor offers; choosing one makes an empty exhbt in it.
 * An address that already says what is being drafted skips the chooser and opens the upload form:
 * `?start=draft`, and `?into=<id>` (a teammate drafting their own exhbt from a team project).
 *
 * Every screen here is links and forms, so it works before, or without, the page's scripts.
 */
export default async function NewExhbtPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!isPhase2Enabled()) notFound();
  const q = await searchParams;
  const view = addExhbtView(q);
  const user = await getCurrentUser();
  if (!user) {
    // Portfolio first, the plain chooser's sign-in comes back to the portfolio, where adding one starts.
    if (view === "choose" && !q.into && (await portfolioKind(false)) === "page") redirect("/login?next=/portfolio");
    const back = q.into ? `${ADD_EXHBT}?into=${q.into}` : view === "draft" ? DRAFT_WITH_AI : view === "blank" ? BUILD_IT_YOURSELF : ADD_EXHBT;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  // The upload form checks its own allowance, and an exhbt being drafted into already has its place in the plan.
  if (view === "draft") return <DraftPage user={user} intoParam={q.into} />;

  const store = getStore();
  const [plan, exhbts] = await Promise.all([getPlan(user.id), store.listExhbts(user.id)]);
  const room = canCreateExhbt(plan, exhbts);
  const portfolioFirst = (await portfolioKind(await isAdmin(user))) === "page";
  if (!room.ok) return <NoRoom reason={room.reason} upgradeTo={room.upgradeTo} portfolioFirst={portfolioFirst} />;

  // The layouts this person's editor offers (decided as the edit page decides it), and whether an AI draft is left.
  const [offered, draft] = await Promise.all([editorKind(await isAdmin(user)).then(offeredIn), draftVerdict(user.id)]);
  if (view === "blank") return <LayoutGallery offered={offered} refused={q.refused === "1"} canDraft={draft.ok} />;

  const [profile, host] = await Promise.all([store.getPortfolioProfile(user.id), headers().then((h) => h.get("x-forwarded-host") ?? h.get("host"))]);
  // Where the exhbt ends up: on a plan with a public portfolio, at the person's own address; on Free, why not yet.
  const publish = canPublish(plan, exhbts, "");
  const where: Where = ENTITLEMENTS[plan].publicPortfolio
    ? { live: true, liveBase: profile.username ? portfolioHref(profile.username, host) : null }
    : { live: false, reason: publish.ok ? "" : publish.reason };
  return <Chooser draft={draft} offered={offered} where={where} portfolioFirst={portfolioFirst} />;
}

/**
 * Upload → AI draft (docs/phase-2.md section 6). Files are read in the browser and uploaded
 * straight to Storage; the draft is made on the server and opens in the editor.
 *
 * `?into=<id>`: a teammate drafting their own exhbt from a team project (decision 0013). The
 * project's files they were given are read in the browser like new ones, and the draft fills
 * that exhbt instead of starting another.
 */
async function DraftPage({ user, intoParam }: { user: SessionUser; intoParam?: string }) {
  let into: string | undefined;
  const preload: PreloadFile[] = [];
  if (intoParam) {
    const target = await getStore().getExhbt(intoParam);
    const mine = target?.userId === user.id ? target.id : null;
    // Not theirs, already written in or live: their editor, or a fresh draft page.
    if (!canDraftInto(target, user.id)) redirect(mine ? `/exhbts/${mine}/edit` : DRAFT_WITH_AI);
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
