import Link from "next/link";

const LINKS = [
  ["/pricing", "Pricing"],
  ["/universities", "For universities"],
  ["/how-to-read-a-pack", "How to read a pack"],
  ["/legal/privacy", "Privacy"],
  ["/legal/terms", "Terms"],
  ["/legal/cookies", "Cookies"],
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-12 text-sm sm:grid-cols-[1fr_auto] sm:px-8">
        <div>
          <p className="inline-flex items-center gap-2 text-[1.3rem] font-extrabold tracking-[-0.04em]">
            <span aria-hidden className="inline-block size-3 rounded-[3px] bg-blue" />
            Exhbt
          </p>
          <p className="mt-3 max-w-sm text-[#c9d7e8]">
            Turns graduates&rsquo; project work into short evidence packs that employers can check.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link className="underline decoration-[#3e5573] underline-offset-4 hover:decoration-blue" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
