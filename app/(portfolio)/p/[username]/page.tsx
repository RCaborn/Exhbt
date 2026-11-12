import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/portfolio/Avatar";
import { loadPortfolio } from "@/lib/portfolio";
import { safeHref } from "@/lib/exhbt/blocks";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await loadPortfolio((await params).username);
  if (p.status !== "ok") return { title: "Portfolio not found", robots: { index: false } };
  return {
    title: { absolute: `${p.displayName} · Portfolio` },
    description: p.profile.headline ?? `Projects by ${p.displayName}.`,
    ...(p.profile.hideFromSearch ? { robots: { index: false, follow: false } } : {}),
  };
}

/** The at-a-glance page: who they are, and every project as a tile. Every shared link lands here. */
export default async function PortfolioGlance({ params }: Params) {
  const p = await loadPortfolio((await params).username);
  if (p.status === "redirect") redirect(p.to);
  if (p.status === "missing") notFound();
  const { profile, displayName, photoUrl, items, base } = p;
  const linkedin = safeHref(profile.linkedin ?? undefined);

  return (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={displayName} photoUrl={photoUrl} size={84} />
        <div className="min-w-0">
          <h1 className="text-[2rem] leading-tight sm:text-[2.4rem]">{displayName}</h1>
          {profile.headline && <p className="mt-1 text-lg text-graphite">{profile.headline}</p>}
          {profile.bio && <p className="mt-2 max-w-[40rem]">{profile.bio}</p>}
          {linkedin && (
            <a href={linkedin} rel="noopener" target="_blank" className="link mt-2 inline-block text-sm font-semibold text-ink">
              LinkedIn
            </a>
          )}
        </div>
      </header>

      <h2 className="sr-only">Projects</h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`${base}/${it.slug}`}
              className="group flex h-full flex-col rounded-[16px] border border-line bg-surface p-5 hover:border-ink"
            >
              {it.doc.headline && (
                <p className="text-[2rem] leading-none font-extrabold tracking-[-0.03em]">
                  {it.doc.headline.value} <span className="text-base font-semibold tracking-normal text-graphite">{it.doc.headline.label}</span>
                </p>
              )}
              <p className={`${it.doc.headline ? "mt-3" : ""} text-[1.15rem] leading-snug font-bold`}>{it.doc.title}</p>
              {it.doc.context && <p className="mt-1 text-sm text-graphite">{it.doc.context}</p>}
              {it.doc.skills.length > 0 && (
                <ul aria-label="Skills" className="mt-3 flex flex-wrap gap-1.5">
                  {it.doc.skills.slice(0, 4).map((s) => (
                    <li key={s} className="rounded-[6px] border border-line bg-mist px-2 py-0.5 font-mono text-[0.72rem]">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold">
                Open project <ArrowRight aria-hidden size={15} strokeWidth={2.25} className="group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
