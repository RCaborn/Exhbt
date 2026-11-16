import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

// Out of search results and out of the page's own listing: the panel is for the team only.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** The panel's frame. Anyone who is not an exhbt_admin gets the 404 page, before anything is drawn. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-svh bg-mist">
      <div className="mx-auto max-w-[72rem] px-4 pt-8 pb-16 sm:px-8">
        <nav aria-label="Admin" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.95rem] font-semibold">
          <span className="text-graphite">Admin</span>
          <Link href="/admin" className="link">
            Overview
          </Link>
          <Link href="/admin/accounts" className="link">
            Accounts
          </Link>
        </nav>
        {children}
      </div>
    </div>
  );
}
