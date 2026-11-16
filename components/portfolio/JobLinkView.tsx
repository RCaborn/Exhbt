import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/portfolio/Avatar";
import type { LoadedJobLink } from "@/lib/job-links";

/**
 * A per-job page (docs/phase-2.md section 8): "For Lloyds Banking Group · Graduate Data Analyst",
 * the person's intro, and their picked exhbts as tiles in the order they chose. Tiles match the
 * at-a-glance page. Each opens the project with ?for=<slug>, so the project page can offer the
 * way back to this page.
 */
export function JobLinkView({ data }: { data: LoadedJobLink }) {
  const { link, displayName, photoUrl, items, base } = data;
  const heading = [link.company, link.roleTitle].filter((s) => s.trim()).join(" · ");
  const forParam = `?for=${encodeURIComponent(link.slug)}`;

  return (
    <>
      <header>
        <div className="flex items-center gap-3">
          <Avatar name={displayName} photoUrl={photoUrl} size={44} />
          <p className="font-semibold">{displayName}</p>
        </div>
        <h1 className="mt-6 text-[2rem] leading-tight sm:text-[2.4rem]">For {heading}</h1>
        {link.intro.trim() && <p className="mt-3 max-w-[40rem] text-lg">{link.intro}</p>}
      </header>

      <h2 className="sr-only">Projects</h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`${base}/${it.slug}${forParam}`}
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

      <p className="mt-8 text-sm">
        <Link href={base || "/"} className="link font-semibold">
          See all of {displayName}&apos;s projects
        </Link>
      </p>
    </>
  );
}
