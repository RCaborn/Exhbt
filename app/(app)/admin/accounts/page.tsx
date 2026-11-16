import Link from "next/link";
import { DataTable, num, when } from "@/components/admin/Admin";
import { Button } from "@/components/ui/Button";
import { ACCOUNTS_PAGE_SIZE, adminAccountsPage, requireAdmin } from "@/lib/admin";
import { cleanQuery } from "@/lib/admin-types";
import { PLAN_NAMES } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = cleanQuery(sp.q ?? "");
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await adminAccountsPage(q, page);
  const pages = Math.max(1, Math.ceil(data.total / ACCOUNTS_PAGE_SIZE));
  const href = (p: number) => `/admin/accounts?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <div className="mt-6">
      <h1>Accounts</h1>
      <form role="search" method="get" action="/admin/accounts" className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="block text-[0.85rem] font-semibold text-graphite">
            Search by email or username
          </label>
          <input id="q" name="q" type="search" defaultValue={q} autoComplete="off" className="mt-1 w-72 max-w-full rounded-[14px] border border-field bg-surface px-3.5 py-2.5" />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {q && (
          <Link href="/admin/accounts" className="link py-2.5">
            Clear
          </Link>
        )}
      </form>

      <p className="mt-4 text-[0.9rem] text-graphite" aria-live="polite">
        <span data-stat="accounts-found">{num(data.total)}</span> {data.total === 1 ? "account" : "accounts"}
        {q ? ` match "${q}"` : ""}. Newest first.
      </p>

      <div className="mt-3 rounded-[16px] border border-line bg-surface p-5">
        <DataTable
          caption="Accounts"
          head={["Email", "Created", "Plan", "Username", "Roadmaps", "Exhbts", "Last activity"]}
          numeric={[4, 5]}
          empty="No accounts match."
          rows={data.rows.map((a) => [
            <Link key={a.id} href={`/admin/accounts/${encodeURIComponent(a.id)}`} className="link">
              {a.email}
            </Link>,
            when(a.createdAt),
            `${PLAN_NAMES[a.plan]}${a.comp ? " (comp)" : ""}`,
            a.username ?? "-",
            num(a.roadmaps),
            num(a.exhbts),
            when(a.lastActive),
          ])}
        />
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center gap-4 text-[0.95rem] font-semibold">
          {data.page > 1 ? (
            <Link href={href(data.page - 1)} rel="prev" className="link">
              Previous
            </Link>
          ) : (
            <span className="text-slate">Previous</span>
          )}
          <span className="text-graphite">
            Page {data.page} of {pages}
          </span>
          {data.page < pages ? (
            <Link href={href(data.page + 1)} rel="next" className="link">
              Next
            </Link>
          ) : (
            <span className="text-slate">Next</span>
          )}
        </nav>
      )}
    </div>
  );
}
