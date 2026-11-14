import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { MobileNav } from "./MobileNav";

const NAV = [
  { href: "/how-to-read-an-exhbt", label: "For employers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/universities", label: "For universities" },
];

/** What a signed-in person needs from the header: their own exhbts, portfolio and account. */
const OWN_NAV = [
  { href: "/roadmap", label: "Roadmaps" },
  { href: "/exhbts", label: "Your exhbts" },
  { href: "/job-links", label: "Job links" },
  { href: "/account/portfolio", label: "Portfolio" },
  { href: "/account", label: "Account" },
];

export function Wordmark() {
  return <Logo href="/" />;
}

/**
 * The header. Marketing pages call it bare, so they stay static. The app layout
 * (app/(app)/layout.tsx) reads the session on the server and passes `signedIn`, which swaps
 * the marketing links and "Log in" for the person's own links: no flash, no extra request.
 * With Phase 2 off (`phase2` false) there are no exhbts or portfolio yet, so only Account shows.
 * Job links show only for plans that include them (`jobLinks`).
 */
export function SiteHeader({
  signedIn = false,
  phase2 = false,
  jobLinks = false,
}: { signedIn?: boolean; phase2?: boolean; jobLinks?: boolean } = {}) {
  const nav = signedIn ? OWN_NAV.filter((n) => (n.href === "/job-links" ? phase2 && jobLinks : phase2 || n.href === "/account" || n.href === "/roadmap")) : NAV;
  return (
    <header className="relative border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[78rem] items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex gap-7 text-[0.95rem] font-medium text-graphite">
            {nav.map((n) => (
              <li key={n.href} className="shrink-0">
                <Link href={n.href} className="hover:text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-4 text-[0.95rem]">
          <MobileNav items={nav} />
          {!signedIn && (
            <Link href="/login" className="link font-medium">
              Log in
            </Link>
          )}
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
