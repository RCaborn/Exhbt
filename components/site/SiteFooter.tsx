import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto grid max-w-[76rem] gap-8 px-4 py-10 text-sm text-ink-2 sm:grid-cols-[1fr_auto] sm:px-8">
        <p className="max-w-sm">
          Exhbt turns graduates&rsquo; project work into short evidence packs that employers can check.
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link className="link" href="/pricing">Pricing</Link></li>
            <li><Link className="link" href="/universities">For universities</Link></li>
            <li><Link className="link" href="/how-to-read-a-pack">How to read a pack</Link></li>
            <li><Link className="link" href="/legal/privacy">Privacy</Link></li>
            <li><Link className="link" href="/legal/terms">Terms</Link></li>
            <li><Link className="link" href="/legal/cookies">Cookies</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
