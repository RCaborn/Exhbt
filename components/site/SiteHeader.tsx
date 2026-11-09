import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

const NAV = [
  { href: "/how-to-read-an-exhbt", label: "For employers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/universities", label: "For universities" },
];

export function Wordmark() {
  return <Logo href="/" />;
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 overflow-x-auto text-[0.95rem] font-medium text-graphite sm:gap-7">
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
          <span className="hidden sm:inline-flex">
            <Button href="/roadmap/new" variant="primary">
              Build my roadmap
            </Button>
          </span>
        </div>
      </div>
    </header>
  );
}
