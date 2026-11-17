import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { personFrom } from "@/components/portfolio/PortfolioPage";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { ENTITLEMENTS, PLAN_NAMES } from "@/lib/entitlements";
import { signedFileUrl } from "@/lib/files";
import { previewImage } from "@/lib/og/card";
import { JsonLd } from "@/components/seo/JsonLd";
import { personLd, portfolioCanonical } from "@/lib/seo";
import { MARKETING_HOST, parseHost } from "@/lib/hosts";
import { loadPortfolio } from "@/lib/portfolio";
import { EXTRA_SECTIONS, sectionsOf } from "@/lib/portfolio-layout";
import { themeFor } from "@/lib/portfolio-themes";
import { getStore } from "@/lib/store";

type Params = { params: Promise<{ username: string }> };

/** The tab title: the person's name first, then what they do. */
const pageTitle = (name: string, headline: string | null) => (headline ? `${name} · ${headline}` : `${name} · Portfolio`);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok" || p.items.length === 0) {
    // The owner's preview of an unpublished page (below) is never for search engines either.
    const ownerId = p.status === "empty" ? p.userId : p.status === "ok" ? p.profile.userId : null;
    const user = ownerId ? await getCurrentUser() : null;
    if (user && user.id === ownerId) {
      const profile = await getStore().getPortfolioProfile(ownerId);
      return { title: { absolute: `Preview · ${profile.name?.trim() || profile.username}` }, robots: { index: false, follow: false } };
    }
    return { title: "Portfolio not found", robots: { index: false } };
  }
  const title = pageTitle(p.displayName, p.profile.headline);
  const description = p.profile.bio?.split(/\n/)[0] || p.profile.headline || `Projects by ${p.displayName}.`;
  const image = await previewImage(p.base, `${p.displayName}'s portfolio`);
  return {
    title: { absolute: title },
    description,
    // Always the person's own host, whichever address this was opened on (localhost, /p/name).
    alternates: { canonical: portfolioCanonical(p.profile.username) },
    icons: { icon: [{ url: `${p.base}/initials.svg`, type: "image/svg+xml" }] },
    // The link preview (preview.png beside this page) shows whatever the search setting; that only stops indexing.
    openGraph: { type: "profile", url: portfolioCanonical(p.profile.username), title, description, siteName: "exhbt", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    ...(p.profile.hideFromSearch ? { robots: { index: false, follow: false } } : {}),
  };
}

/** On alex.exhbt.co.uk a relative "/start" would stay on the portfolio host; send people to our site. */
async function startHref() {
  return parseHost((await headers()).get("host")).kind === "portfolio" ? `https://${MARKETING_HOST}/start` : "/start";
}

/** The portfolio home (decision 0016): who they are, their best work, more of it, about them. Every shared link lands here. */
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
    <main id="main">
      <JsonLd data={personLd({ name: p.displayName, username: p.profile.username, headline: p.profile.headline, linkedin: p.profile.linkedin, github: p.profile.github })} />
      <PortfolioHome
        person={personFrom(p.profile, p.displayName, p.photoUrl, p.layout)}
        theme={p.theme}
        projects={p.projects}
        featuredId={p.featuredId}
        sections={p.sections}
        tiles={p.layout.tiles}
        startHref={await startHref()}
      />
    </main>
  );
}

/**
 * What the owner sees at their own address before anything is live: the page as it will look, with
 * a note saying why visitors can't see it yet and what to do. Signed in on this origin only (sign-in
 * cookies stay on the app host, so on a portfolio subdomain the owner gets not found like anyone else).
 */
async function OwnerPreview({ userId, allHidden }: { userId: string; base: string; allHidden: boolean }) {
  const store = getStore();
  const [profile, plan] = await Promise.all([store.getPortfolioProfile(userId), store.planFor(userId)]);
  const name = profile.name?.trim() || profile.username || "Your name";
  const photoUrl = await signedFileUrl(profile.photoFileId);
  const isPublic = ENTITLEMENTS[plan].publicPortfolio;
  const message = !isPublic
    ? `This is a preview. Portfolios go public on ${PLAN_NAMES.premium}, so visitors can’t see this page yet.`
    : allHidden
      ? "Every exhbt is hidden, so visitors can’t see this page. Show at least one and it comes back."
      : "This is how your page will look. Publish your first exhbt and it goes live at this address.";

  return (
    <main id="main">
      <div data-testid="owner-preview" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-wash px-5 py-4 sm:px-10">
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
      <PortfolioHome
        person={personFrom(profile, name, photoUrl, profile.layout)}
        theme={themeFor(profile, plan)}
        projects={[]}
        featuredId={null}
        sections={sectionsOf(profile.layout).filter((k) => ENTITLEMENTS[plan].extraTiles || !EXTRA_SECTIONS.includes(k))}
        tiles={profile.layout.tiles}
        mode="preview"
        startHref={await startHref()}
      />
    </main>
  );
}
