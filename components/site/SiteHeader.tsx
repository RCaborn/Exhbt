import Link from "next/link";

const NAV = [
  { href: "/how-to-read-a-pack", label: "How to read a pack" },
  { href: "/pricing", label: "Pricing" },
  { href: "/universities", label: "For universities" },
];

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-[1.55rem] leading-none font-extrabold tracking-[-0.04em]" aria-label="Exhbt home">
      <span aria-hidden className="inline-block size-3.5 rounded-[4px] border-2 border-ink bg-blue" />
      Exhbt
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 overflow-x-auto text-[0.95rem] font-medium text-ink-2 sm:gap-7">
            {NAV.map((n) => (
              <li key={n.href} className="shrink-0">
                <Link href={n.href} className="hover:text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-4 text-[0.95rem]">
          <Link href="/login" className="link font-medium">
            Log in
          </Link>
          <Link href="/roadmap/new" className="btn btn-primary hidden min-h-10 sm:inline-flex">
            Build my roadmap
          </Link>
        </div>
      </div>
    </header>
  );
}
