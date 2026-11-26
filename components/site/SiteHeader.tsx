import { Link } from "@astryxdesign/core/Link";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { HeaderLinks } from "./HeaderLinks";
import { MobileNav } from "./MobileNav";
import { appNav } from "./app-nav";
import type { PortfolioKind } from "@/lib/portfolio-kind";
import "./shell.css";

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
 * The header, drawn by Astryx: a TopNav with the logo in its heading, the "Main" navigation in its start slot
 * and "Log in" or "Account" in its end slot; below a breakpoint the row gives way to a Menu button and
 * Astryx's MobileNav drawer. Marketing pages call it bare, so they stay static. The app layout
 * (app/(app)/layout.tsx) reads the session on the server and passes `signedIn`, which swaps the marketing
 * links and "Log in" for the person's own links: no flash, no extra request.
 * With Phase 2 off (`phase2` false) there are no exhbts or portfolio yet, so the nav is just Roadmaps.
 * `portfolio` is the structure the person gets (lib/portfolio-kind.ts); the nav for each is in app-nav.ts.
 * Job links are a section of the portfolio page, so the header does not list them.
 *
 * TopNav always makes its whole bar a navigation landmark. The site's "Main" navigation has only ever held the
 * links (the logo and the account control sit beside it, and e2e/portfolio-landing.spec.ts reads it), so the
 * bar's own landmark is turned off (role "none", no name) and HeaderLinks carries the "Main" one. The `header`
 * element is the banner. Layout only is in shell.css; every colour and type setting comes from the theme.
 */
export function SiteHeader({
  signedIn = false,
  phase2 = false,
  portfolio = "steps",
}: { signedIn?: boolean; phase2?: boolean; portfolio?: PortfolioKind } = {}) {
  const nav = signedIn ? appNav(portfolio, phase2) : NAV;
  return (
    <header className="site-header">
      <TopNav
        role="none"
        aria-label={undefined}
        className="site-nav"
        heading={<TopNavHeading logo={<Logo />} logoLabel="Exhbt home" headingHref="/" />}
        startContent={
          <HeaderLinks
            items={nav}
            className={signedIn ? "hidden sm:flex" : "hidden lg:flex"}
            middle={
              signedIn ? undefined : (
                <Button href={ROADMAP.href} variant={ROADMAP.variant} size="sm">
                  {ROADMAP.label}
                </Button>
              )
            }
          />
        }
        endContent={
          <div className="site-nav-end text-[0.95rem]">
            <MobileNav items={nav} actions={signedIn ? [] : [ROADMAP]} breakpoint={signedIn ? "sm" : "lg"} />
            {signedIn ? (
              <Button href="/account" variant="secondary" size="sm">
                Account
              </Button>
            ) : (
              <Link href="/login" color="primary" weight="medium" hasUnderline>
                Log in
              </Link>
            )}
          </div>
        }
      />
    </header>
  );
}
