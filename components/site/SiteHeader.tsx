import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { HeaderLinks } from "./HeaderLinks";
import { MobileNav } from "./MobileNav";

/** Signed out: two pages, then the two ways in. Employers and universities are in the footer. */
const NAV = [
  { href: "/what-is-an-exhbt", label: "What is an exhbt?" },
  { href: "/pricing", label: "Pricing" },
];

/** The two ways in, in the header and in the phone menu. */
export const ACTIONS = [
  { href: "/exhbts/new", label: "Build your exhbt", variant: "secondary" },
  { href: "/roadmap/new", label: "Build your roadmap", variant: "primary" },
] as const;

/** What a signed-in person needs from the header: their own exhbts, portfolio and account. */
const OWN_NAV = [
  { href: "/roadmap", label: "Roadmaps" },
  { href: "/exhbts", label: "Your exhbts" },
  { href: "/job-links", label: "Job links" },
  { href: "/portfolio", label: "Portfolio" },
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
        <nav aria-label="Main" className={signedIn ? "hidden sm:block" : "hidden lg:block"}>
          <HeaderLinks items={nav} />
        </nav>
        <div className="flex items-center gap-4 text-[0.95rem]">
          <MobileNav items={nav} actions={signedIn ? [] : [...ACTIONS]} breakpoint={signedIn ? "sm" : "lg"} />
          {signedIn && (
            <span className="hidden sm:inline-flex">
              <Button href="/roadmap/new" variant="primary">
                Build your roadmap
              </Button>
            </span>
          )}
          {!signedIn && (
            <>
              <Link href="/login" className="link font-medium">
                Log in
              </Link>
              <span className="hidden items-center gap-2 lg:inline-flex">
                {ACTIONS.map((a) => (
                  <Button key={a.href} href={a.href} variant={a.variant}>
                    {a.label}
                  </Button>
                ))}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
