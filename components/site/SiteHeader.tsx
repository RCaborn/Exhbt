import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { HeaderLinks } from "./HeaderLinks";
import { MobileNav } from "./MobileNav";
import { appNav } from "./app-nav";
import type { PortfolioKind } from "@/lib/portfolio-kind";

/** Signed out: the information pages. The roadmap button sits between them. */
const NAV = [
  { href: "/what-is-an-exhbt", label: "What is an exhbt?" },
  { href: "/pricing", label: "Pricing" },
];

/** The one marketing call to action that stays in the header. The page's own button is the mint one. */
const ROADMAP = { href: "/roadmap/new", label: "Build your roadmap", variant: "secondary" } as const;

export function Wordmark() {
  return <Logo href="/" />;
}

/**
 * The header. Marketing pages call it bare, so they stay static. The app layout
 * (app/(app)/layout.tsx) reads the session on the server and passes `signedIn`, which swaps
 * the marketing links and "Log in" for the person's own links: no flash, no extra request.
 * With Phase 2 off (`phase2` false) there are no exhbts or portfolio yet, so the nav is just Roadmaps.
 * `portfolio` is the structure the person gets (lib/portfolio-kind.ts); the nav for each is in app-nav.ts.
 * Job links are a section of the portfolio page, so the header does not list them.
 */
export function SiteHeader({
  signedIn = false,
  phase2 = false,
  portfolio = "steps",
}: { signedIn?: boolean; phase2?: boolean; portfolio?: PortfolioKind } = {}) {
  const nav = signedIn ? appNav(portfolio, phase2) : NAV;
  return (
    <header className="relative border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[78rem] items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className={signedIn ? "hidden sm:block" : "hidden lg:block"}>
          <HeaderLinks
            items={nav}
            middle={
              signedIn ? undefined : (
                <Button href={ROADMAP.href} variant={ROADMAP.variant} size="sm">
                  {ROADMAP.label}
                </Button>
              )
            }
          />
        </nav>
        <div className="flex items-center gap-4 text-[0.95rem]">
          <MobileNav items={nav} actions={signedIn ? [] : [ROADMAP]} breakpoint={signedIn ? "sm" : "lg"} />
          {signedIn ? (
            <Button href="/account" variant="secondary" size="sm">
              Account
            </Button>
          ) : (
            <Link href="/login" className="link font-medium whitespace-nowrap">
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
