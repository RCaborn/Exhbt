import Link from "next/link";
import { ExhbtTile } from "@/components/exhbt/ExhbtTile";
import { Avatar } from "@/components/portfolio/Avatar";
import { tileFromDoc } from "@/lib/exhbt/headline";
import type { LoadedJobLink } from "@/lib/job-links";

/**
 * A per-job page (docs/phase-2.md section 8): "For Lloyds Banking Group · Graduate Data Analyst",
 * the person's intro, and their picked exhbts as tiles in the order they chose. The tiles are the
 * at-a-glance page's own (ExhbtTile), numbered in this link's order (docs/brand.md). Each opens the project with ?for=<slug>, so the project page can offer the
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
      <ul className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
        {items.map((it, i) => (
          <li key={it.id}>
            <ExhbtTile exhbt={tileFromDoc(it.doc)} href={`${base}/${it.slug}${forParam}`} position={i + 1} />
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
