import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const LINKS = [
  ["/what-is-an-exhbt", "What is an exhbt?"],
  ["/pricing", "Pricing"],
  ["/universities", "For universities"],
  ["/how-to-read-an-exhbt", "How to read an exhbt"],
  ["/legal/privacy", "Privacy"],
  ["/legal/terms", "Terms"],
  ["/legal/cookies", "Cookies"],
  ["/start", "Quick start"],
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-12 text-sm sm:grid-cols-[1fr_auto] sm:px-8">
        <div>
          <Logo className="text-white" />
          <p className="mt-3 max-w-sm text-[#c9cbcf]">
            Your own portfolio site at name.exhbt.co.uk, built from your projects.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link className="underline decoration-[#3e4044] underline-offset-4 hover:decoration-mint" href={href}>
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
