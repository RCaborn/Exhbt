import Link from "next/link";
import { DataTable, DayColumns, Panel, Stats, Unavailable, bytes, num, pct, usd, when } from "@/components/admin/Admin";
import { adminOverview, parseRange, RANGES, RANGE_LABEL, requireAdmin, type Overview, type Section } from "@/lib/admin";
import { PLAN_NAMES } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

/** Reads a section: its data, or a quiet note in its place. */
function Part<T>({ s, children }: { s: Section<T>; children: (d: T) => React.ReactNode }) {
  return s.ok ? <>{children(s.data)}</> : <Unavailable note={s.note} />;
}

const stepName = (s: string) => s.replace(/_/g, " ");

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const range = parseRange((await searchParams).range);
  const o = await adminOverview(range);
  const partial = ([o.accounts, o.roadmaps, o.ideas, o.exhbts, o.ai, o.subscriptions, o.referrals, o.waitlist, o.leads, o.jobLinks, o.teammates, o.files, o.matches, o.pageViews] as Section<unknown>[]).some((s) => s.ok && s.partial);
  const label = RANGE_LABEL[range].toLowerCase();

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1>Overview</h1>
        <nav aria-label="Date range">
          <ul className="flex gap-1 rounded-full border border-line bg-surface p-1 text-[0.9rem] font-semibold">
            {RANGES.map((r) => (
              <li key={r}>
                <Link
                  href={r === "30d" ? "/admin" : `/admin?range=${r}`}
                  aria-current={r === range ? "page" : undefined}
                  className={`block rounded-full px-3.5 py-1.5 ${r === range ? "bg-ink text-white" : "text-graphite hover:text-ink"}`}
                >
                  {RANGE_LABEL[r]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mt-2 text-[0.9rem] text-graphite">
        {range === "all" ? "Everything so far." : `The last ${label}, today included.`} Days are UTC. Totals marked all time ignore the range.
      </p>
      {partial && <p className="mt-2 text-[0.9rem] text-error">Some tables are bigger than this page reads in one go, so those figures are partial.</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Accounts o={o} />
        <PageViews o={o} />
        <Roadmaps o={o} />
        <Ideas o={o} />
        <Exhbts o={o} />
        <Ai o={o} />
        <AiFailures o={o} />
        <Subscriptions o={o} />
        <Referrals o={o} />
        <Leads o={o} />
        <Everything o={o} />
        <Matches o={o} />
      </div>
    </div>
  );
}

function Accounts({ o }: { o: Overview }) {
  return (
    <Panel id="accounts" title="Accounts" wide>
      <Part s={o.accounts}>
        {(a) => (
          <>
            <Stats
              items={[
                { id: "accounts-total", label: "Accounts, all time", value: num(a.total) },
                { id: "accounts-new", label: `New in range`, value: num(a.inRange) },
                ...a.byPlan.map((p) => ({
                  id: `plan-${p.plan}`,
                  label: PLAN_NAMES[p.plan],
                  value: num(p.total),
                  hint: p.comp ? `${num(p.comp)} comp` : undefined,
                })),
              ]}
            />
            <DayColumns title="New accounts per day" data={a.daily} />
          </>
        )}
      </Part>
    </Panel>
  );
}

function PageViews({ o }: { o: Overview }) {
  return (
    <Panel id="page-views" title="Page views" note="Anonymous: the page and the site that sent the visitor. No cookies, no IP address." wide>
      <Part s={o.pageViews}>
        {(v) => (
          <>
            <Stats items={[{ id: "views-total", label: "Page views", value: num(v.total) }, { id: "views-portfolio", label: "On portfolios", value: num(v.portfolio), hint: pct(v.portfolio, v.total) }]} />
            <DayColumns title="Page views per day" data={v.daily} />
            <div className="grid gap-4 sm:grid-cols-2">
              <DataTable caption="Top pages" head={["Page", "Views"]} numeric={[1]} rows={v.paths.map((p) => [p.key, num(p.n)])} empty="No views in this range." />
              <DataTable caption="Top referring sites" head={["Site", "Views"]} numeric={[1]} rows={v.referrers.map((p) => [p.key, num(p.n)])} empty="No referrers in this range." />
            </div>
          </>
        )}
      </Part>
    </Panel>
  );
}

function Roadmaps({ o }: { o: Overview }) {
  return (
    <Panel id="roadmaps" title="Roadmaps" wide>
      <Part s={o.roadmaps}>
        {(r) => (
          <>
            <Stats
              items={[
                { id: "roadmaps-total", label: "Roadmaps made", value: num(r.total) },
                { id: "roadmaps-fresh", label: "Written fresh", value: num(r.fresh), hint: "completed runs" },
                { id: "roadmaps-cached", label: "From the cache", value: num(r.cached), hint: "completed runs" },
                { id: "roadmaps-failed", label: "Failed", value: num(r.failures) },
                { id: "people-one", label: "People with 1", value: num(r.perPerson.one) },
                { id: "people-two", label: "People with 2", value: num(r.perPerson.two) },
                { id: "people-three", label: "People with 3 or more", value: num(r.perPerson.threePlus) },
                { id: "roadmaps-signed-out", label: "Not yet tied to an account", value: num(r.perPerson.signedOut) },
              ]}
            />
            <DayColumns title="Roadmaps per day" data={r.daily} />
            <DataTable
              caption="Top 10 people by roadmaps"
              head={["Account", "Roadmaps"]}
              numeric={[1]}
              rows={r.topUsers.map((u) => [<Link key={u.userId} href={`/admin/accounts/${encodeURIComponent(u.userId)}`} className="link">{u.email}</Link>, num(u.n)])}
              empty="No signed-in roadmaps in this range."
            />
          </>
        )}
      </Part>
    </Panel>
  );
}

function Ideas({ o }: { o: Overview }) {
  return (
    <Panel id="ideas" title="Project ideas">
      <Part s={o.ideas}>
        {(i) => (
          <Stats
            items={[
              { id: "ideas-generated", label: "Ideas written", value: num(i.generated) },
              { id: "ideas-swaps", label: "Swaps", value: num(i.swaps) },
              { id: "ideas-saved", label: "Saved ideas", value: num(i.saved) },
              { id: "ideas-failures", label: "Failed runs", value: num(i.failures), hint: i.roadmapsFailed === null ? "roadmap flag not on this database yet" : `${num(i.roadmapsFailed)} roadmaps flagged failed now` },
            ]}
          />
        )}
      </Part>
    </Panel>
  );
}

function Exhbts({ o }: { o: Overview }) {
  return (
    <Panel id="exhbts" title="Exhbts">
      <Part s={o.exhbts}>
        {(e) => (
          <>
            <Stats
              items={[
                { id: "exhbts-drafted", label: "Started", value: num(e.drafted) },
                { id: "exhbts-published", label: "Published", value: num(e.published) },
                { id: "exhbts-ai-drafts", label: "AI drafts used", value: num(e.aiDrafts) },
                { id: "exhbts-ai-rewrites", label: "AI rewrites used", value: num(e.aiRewrites) },
              ]}
            />
            <DataTable
              caption="Exhbts started, per person"
              head={["People with", "Count"]}
              numeric={[1]}
              rows={[
                ["One", num(e.perPerson.one)],
                ["Two", num(e.perPerson.two)],
                ["3 or more", num(e.perPerson.threePlus)],
              ]}
            />
          </>
        )}
      </Part>
    </Panel>
  );
}

function Ai({ o }: { o: Overview }) {
  return (
    <Panel id="ai" title="AI usage and cost" note="From the call log: what each call cost us, not what a person pays." wide>
      <Part s={o.ai}>
        {(a) => (
          <>
            <Stats
              items={[
                { id: "ai-cost", label: "Total cost", value: usd(a.costUsd) },
                { id: "ai-calls", label: "Calls", value: num(a.calls) },
                { id: "ai-in", label: "Input tokens", value: num(a.inputTokens) },
                { id: "ai-out", label: "Output tokens", value: num(a.outputTokens) },
              ]}
            />
            <DayColumns title="AI cost per day (USD)" data={a.dailyCost} format={usd} />
            <DataTable
              caption="AI usage by step"
              head={["Step", "Calls", "Cost", "Input tokens", "Output tokens"]}
              numeric={[1, 2, 3, 4]}
              rows={a.steps.map((s) => [stepName(s.step), num(s.calls), usd(s.costUsd), num(s.inputTokens), num(s.outputTokens)])}
              empty="No AI calls in this range."
            />
            {a.byDay.length > 0 && (
              <details>
                <summary className="cursor-pointer text-[0.9rem] font-semibold text-jade">Calls and cost, step by step, day by day</summary>
                <div className="mt-3">
                  <DataTable
                    caption="AI calls and cost per step per day"
                    head={["Day", "Step", "Calls", "Cost"]}
                    numeric={[2, 3]}
                    rows={a.byDay.flatMap((d) => d.steps.map((s) => [d.day, stepName(s.step), num(s.calls), usd(s.costUsd)]))}
                  />
                </div>
              </details>
            )}
          </>
        )}
      </Part>
    </Panel>
  );
}

function AiFailures({ o }: { o: Overview }) {
  return (
    <Panel id="ai-failures" title="Failed AI calls" note="From the failure events: each failed call, why it failed and the tokens it still spent. Never any text from the person or the model." wide>
      <Part s={o.aiFailures}>
        {(f) => (
          <>
            <Stats
              items={[
                { id: "ai-failures-total", label: "Failed calls", value: num(f.total) },
                { id: "ai-failures-cost", label: "Their cost", value: usd(f.costUsd) },
                { id: "ai-failures-in", label: "Input tokens", value: num(f.inputTokens) },
                { id: "ai-failures-out", label: "Output tokens", value: num(f.outputTokens) },
              ]}
            />
            <DataTable
              caption="Failed AI calls by feature"
              head={["Feature", "Failed", "Why", "Input tokens", "Output tokens", "Cost"]}
              numeric={[1, 3, 4, 5]}
              rows={f.features.map((r) => [r.label, num(r.failures), r.reasons || "none", num(r.inputTokens), num(r.outputTokens), usd(r.costUsd)])}
            />
          </>
        )}
      </Part>
    </Panel>
  );
}

function Subscriptions({ o }: { o: Overview }) {
  return (
    <Panel id="subscriptions" title="Subscriptions" note="From our own records, no calls to Stripe. Comp means a subscription we gave.">
      <Part s={o.subscriptions}>
        {(s) => (
          <>
            <Stats items={[{ id: "subs-active", label: "Active subscriptions", value: num(s.activeTotal) }]} />
            <DataTable
              caption="Active subscriptions by plan"
              head={["Plan", "Paying", "Comp"]}
              numeric={[1, 2]}
              rows={s.active.map((r) => [PLAN_NAMES[r.plan], num(r.paying), num(r.comp)])}
              empty="No active subscriptions."
            />
          </>
        )}
      </Part>
    </Panel>
  );
}

function Referrals({ o }: { o: Overview }) {
  return (
    <Panel id="referrals" title="Referrals">
      <Part s={o.referrals}>
        {(r) => (
          <>
            <Stats items={[{ id: "ref-pending", label: "Pending", value: num(r.pending) }, { id: "ref-earned", label: "Earned", value: num(r.earned) }, { id: "ref-credited", label: "Credited", value: num(r.credited) }]} />
            <DataTable caption="Latest referrals" head={["Referrer", "Referred", "Status", "Date"]} rows={r.list.map((x) => [x.referrer, x.referred, x.status, when(x.createdAt)])} empty="No referrals in this range." />
          </>
        )}
      </Part>
    </Panel>
  );
}

function Leads({ o }: { o: Overview }) {
  return (
    <Panel id="leads" title="Waitlist and university leads" wide>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-[1rem]">Waitlist</h3>
          <Part s={o.waitlist}>
            {(w) => (
              <>
                <p className="text-[0.9rem] text-graphite"><span data-stat="waitlist-total" className="font-semibold text-ink">{num(w.total)}</span> in this range</p>
                <DataTable caption="Latest waitlist sign-ups" head={["Email", "Interest", "Source", "Date"]} rows={w.list.map((x) => [x.email, x.interest, x.source, when(x.at)])} empty="Nobody yet." />
              </>
            )}
          </Part>
        </div>
        <div className="space-y-2">
          <h3 className="text-[1rem]">University leads</h3>
          <Part s={o.leads}>
            {(l) => (
              <>
                <p className="text-[0.9rem] text-graphite"><span data-stat="leads-total" className="font-semibold text-ink">{num(l.total)}</span> in this range</p>
                <DataTable caption="Latest university leads" head={["Name", "Email", "Institution", "Date"]} rows={l.list.map((x) => [x.name, x.email, x.institution, when(x.at)])} empty="No leads yet." />
              </>
            )}
          </Part>
        </div>
      </div>
    </Panel>
  );
}

function Everything({ o }: { o: Overview }) {
  return (
    <Panel id="more" title="Job links, teammates and files" note="All time." wide>
      <div className="grid gap-6 lg:grid-cols-3">
        <Part s={o.jobLinks}>{(j) => <Stats items={[{ id: "joblinks-total", label: "Job links", value: num(j.total), hint: `${num(j.live)} live` }, { id: "joblinks-views", label: "Job link views", value: num(j.views) }]} />}</Part>
        <Part s={o.teammates}>
          {(t) => (
            <Stats
              items={[
                { id: "team-members", label: "Teammates added", value: num(t.members) },
                { id: "team-invites-open", label: "Invites open", value: num(t.invitesOpen), hint: `${num(t.invitesAccepted)} accepted, ${num(t.invitesCancelled)} cancelled` },
              ]}
            />
          )}
        </Part>
        <Part s={o.files}>
          {(f) => (
            <DataTable caption="File uploads by bucket" head={["Bucket", "Files", "Size"]} numeric={[1, 2]} rows={f.buckets.map((b) => [b.bucket, num(b.count), bytes(b.bytes)])} empty="No files uploaded." />
          )}
        </Part>
      </div>
    </Panel>
  );
}

function Matches({ o }: { o: Overview }) {
  return (
    <Panel id="matches" title="Duplicate file matches" note="Review queue: when the same file turned up on two accounts. Outcome and date only; no files and no people." wide>
      <Part s={o.matches}>
        {(m) => (
          <>
            <p className="text-[0.9rem] text-graphite"><span data-stat="matches-total" className="font-semibold text-ink">{num(m.total)}</span> in this range</p>
            <DataTable caption="Latest duplicate file matches" head={["Match", "Outcome", "Date"]} rows={m.list.map((x) => [x.id.slice(0, 8), x.outcome, when(x.createdAt)])} empty="No matches in this range." />
          </>
        )}
      </Part>
    </Panel>
  );
}
