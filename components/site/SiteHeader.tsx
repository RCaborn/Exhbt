import Link from "next/link";

const NAV = [
  { href: "/how-to-read-a-pack", label: "How to read a pack" },
  { href: "/pricing", label: "Pricing" },
  { href: "/universities", label: "For universities" },
];

export function Wordmark() {
  return (
    <Link href="/" className="font-display text-[1.6rem] leading-none tracking-[-0.02em]" aria-label="Exhbt home">
      Exhbt
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-[76rem] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 overflow-x-auto text-[0.95rem] text-ink-2 sm:gap-7">
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
          <Link href="/login" className="link">
            Log in
          </Link>
          <Link href="/roadmap/new" className="btn btn-primary hidden min-h-10 sm:inline-flex">
            Get your free roadmap
          </Link>
        </div>
      </div>
    </header>
  );
}
