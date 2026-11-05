import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 pt-20 sm:px-8">
        <h1 className="text-[2.4rem]">Page not found</h1>
        <p className="mt-4 text-ink-2">
          The link may be mistyped, or the page may have been removed. If someone sent you a pack, ask them for a new link.
        </p>
        <Link href="/" className="link mt-6 inline-block">Go to the home page</Link>
      </main>
    </>
  );
}
