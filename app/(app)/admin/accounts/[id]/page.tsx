import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, Panel, Stats, bytes, num, usd, when } from "@/components/admin/Admin";
import { adminAccountDetail, requireAdmin } from "@/lib/admin";
import { PLAN_NAMES } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

/** One account, read-only: counts and the person's own events by name and time. Nothing here can be changed. */
export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const a = await adminAccountDetail(decodeURIComponent(id));
  if (!a) notFound();

  return (
    <div className="mt-6">
      <p className="text-[0.9rem]">
        <Link href="/admin/accounts" className="link">
          All accounts
        </Link>
      </p>
      <h1 className="mt-2 break-words">{a.email}</h1>
      <p className="mt-2 text-[0.9rem] text-graphite">
        Created {when(a.createdAt)} UTC. Read only.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel id="summary" title="Summary" wide>
          <Stats
            items={[
              { id: "plan", label: "Plan", value: `${PLAN_NAMES[a.plan]}${a.comp ? " (comp)" : ""}` },
              { label: "Username", value: a.username ?? "-" },
              { label: "Role", value: a.role === "exhbt_admin" ? "Admin" : a.role === "institution_admin" ? "Institution admin" : "Person" },
              { label: "Last activity", value: when(a.lastActive) },
              { id: "detail-roadmaps", label: "Roadmaps", value: num(a.roadmaps) },
              { id: "detail-exhbts", label: "Exhbts", value: num(a.exhbts) },
              { label: "AI calls", value: num(a.aiCalls), hint: `${usd(a.aiCostUsd)} cost` },
              { label: "Files", value: num(a.files), hint: bytes(a.fileBytes) },
            ]}
          />
        </Panel>

        <Panel id="roadmaps" title="Roadmaps">
          <DataTable caption="Roadmaps" head={["Made", "Ideas"]} rows={a.roadmapList.map((r) => [when(r.createdAt), r.ideasFailed === null ? "-" : r.ideasFailed ? "failed" : "ok"])} empty="None." />
        </Panel>

        <Panel id="exhbts" title="Exhbts">
          <DataTable caption="Exhbts" head={["Last saved", "Status"]} rows={a.exhbtList.map((e) => [when(e.createdAt), e.status])} empty="None." />
        </Panel>

        <Panel id="events" title="Latest events" note="The latest 100, by name and time." wide>
          <DataTable caption="Events" head={["Event", "When"]} rows={a.events.map((e) => [e.name.replace(/_/g, " "), when(e.at)])} empty="None." />
        </Panel>
      </div>
    </div>
  );
}
