import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EmptyProjects, GlanceView, personFrom } from "@/components/portfolio/GlanceView";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";
import { signedFileUrl } from "@/lib/files";
import { previewImage } from "@/lib/og/card";
import { loadPortfolio } from "@/lib/portfolio";
import { themeFor } from "@/lib/portfolio-themes";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ username: string }> };

/** The tab title: the person's name first, then what they do. */
const pageTitle = (name: string, headline: string | null) => (headline ? `${name} · ${headline}` : `${name} · Portfolio`);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok" || p.items.length === 0) {
    // The owner's preview of an unpublished page (below) is never for search engines either.
    return { title: "Portfolio not found", robots: { index: false } };
  }
  const title = pageTitle(p.displayName, p.profile.headline);
  const description = p.profile.bio?.split(/\n/)[0] || p.profile.headline || `Projects by ${p.displayName}.`;
  const image = await previewImage(p.base, `${p.displayName}'s portfolio`);
  return {
    title: { absolute: title },
    description,
    icons: { icon: [{ url: `${p.base}/initials.svg`, type: "image/svg+xml" }] },
    // The link preview (preview.png beside this page) shows whatever the search setting; that only stops indexing.
    openGraph: { type: "profile", title, description, siteName: "exhbt", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    ...(p.profile.hideFromSearch ? { robots: { index: false, follow: false } } : {}),
  };
}

/** The at-a-glance page: who they are, and every project as a tile. Every shared link lands here. */
export default async function PortfolioGlance({ params }: Params) {
  const p = await loadPortfolio((await params).username);
  if (p.status === "redirect") redirect(p.to);
  if (p.status === "missing") notFound();

  if (p.status === "empty" || p.items.length === 0) {
    // Nothing live (or every exhbt hidden). Visitors get not found; the owner sees how the page will look.
    const userId = p.status === "empty" ? p.userId : p.profile.userId;
    const user = await getCurrentUser();
    if (!user || user.id !== userId) notFound();
    return <OwnerPreview userId={userId} base={p.base} allHidden={p.status === "ok"} />;
  }

  return (
    <GlanceView
      person={personFrom(p.profile, p.displayName, { photoUrl: p.photoUrl, coverUrl: p.coverUrl }, p.layout)}
      items={p.items}
      order={p.order}
      featuredId={p.featuredId}
      layout={p.layout}
      base={p.base}
      theme={p.theme}
    />
  );
}

/**
 * What the owner sees at their own address before anything is live: the page as it will look, with
 * a note saying why visitors can't see it yet and what to do. Signed in on this origin only (sign-in
 * cookies stay on the app host, so on a portfolio subdomain the owner gets not found like anyone else).
 */
async function OwnerPreview({ userId, base, allHidden }: { userId: string; base: string; allHidden: boolean }) {
  const store = getStore();
  const [profile, plan] = await Promise.all([store.getPortfolioProfile(userId), store.planFor(userId)]);
  const name = profile.name?.trim() || profile.username || "Your name";
  const [photoUrl, coverUrl] = await Promise.all([signedFileUrl(profile.photoFileId), signedFileUrl(profile.coverFileId)]);
  const isPublic = ENTITLEMENTS[plan].publicPortfolio;
  const message = !isPublic
    ? `This is a preview. Portfolios go public on ${PLAN_NAMES.premium}, so visitors can’t see this page yet.`
    : allHidden
      ? "Every exhbt is hidden, so visitors can’t see this page. Show at least one and it comes back."
      : "This is how your page will look. Publish your first exhbt and it goes live at this address.";

  return (
    <>
      <div data-testid="owner-preview" className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[16px] border border-line bg-surface px-5 py-4">
        <p className="max-w-[40rem]">
          <span className="font-semibold">Only you can see this.</span> {message}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button href={allHidden ? "/portfolio?step=projects" : "/exhbts"} size="sm">
            {allHidden ? "Choose what to show" : "Go to your exhbts"}
          </Button>
          <Button href="/portfolio" variant="secondary" size="sm">
            Build your portfolio
          </Button>
        </div>
      </div>
      <GlanceView
        person={personFrom(profile, name, { photoUrl, coverUrl }, profile.layout)}
        items={[]}
        order={[]}
        featuredId={null}
        layout={profile.layout}
        base={base}
        theme={themeFor(profile, plan)}
        empty={<EmptyProjects />}
      />
    </>
  );
}
