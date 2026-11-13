import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PortfolioItem } from "@/lib/portfolio";

/** The page an employer opens: a heading, the introduction, and the chosen projects. */
export function JobLinkView({
  company,
  role,
  intro,
  items,
  base,
  slug,
}: {
  company: string;
  role: string;
  intro: string;
  items: PortfolioItem[];
  base: string;
  slug: string;
}) {
  return (
    <>
      <h1 className="text-[2rem] leading-tight sm:text-[2.4rem]">For {company} · {role}</h1>
      {intro && <p className="mt-4 max-w-[40rem] text-lg">{intro}</p>}
      {items.length === 0 ? (
        <p className="mt-8 text-graphite">None of these projects are on the portfolio at the moment.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`${base}/${it.slug}?for=${encodeURIComponent(slug)}`}
                className="group flex h-full flex-col rounded-[16px] border border-line bg-surface p-5 hover:border-ink"
              >
                {it.doc.headline && (
                  <p className="text-[2rem] leading-none font-extrabold tracking-[-0.03em]">
                    {it.doc.headline.value}{" "}
                    <span className="text-base font-semibold tracking-normal text-graphite">{it.doc.headline.label}</span>
                  </p>
                )}
                <p className={`${it.doc.headline ? "mt-3" : ""} text-[1.15rem] leading-snug font-bold`}>{it.doc.title}</p>
                {it.doc.context && <p className="mt-1 text-sm text-graphite">{it.doc.context}</p>}
                <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold">
                  Open project <ArrowRight aria-hidden size={15} strokeWidth={2.25} className="group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
