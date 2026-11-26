import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cancelInviteAction, decideAction, removeTeammateAction, resendInviteAction } from "@/app/(app)/team/actions";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { Avatar } from "@/components/portfolio/Avatar";
import { Button } from "@/components/ui/Button";
import { isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { portfolioKind } from "@/lib/portfolio-kind-server";
import { joinRequestsFor } from "@/lib/duplicates";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { displayNameFor, membersOf, titleOf } from "@/lib/team";
import { INVITE_DAYS, TEAMMATES_PER_EXHBT } from "@/lib/team-rules";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Teammates", robots: { index: false } };
export const dynamic = "force-dynamic";

/** What the last action did, from `?said=` (app/(app)/team/actions.ts). */
const SAID: Record<string, string> = {
  resent: "Invite sent again, with a new link.",
  "not-sent": "We couldn't send that just now. Try again in a minute.",
  cancelled: "Invite cancelled. The link no longer works.",
  removed: "Teammate removed. They no longer show on this exhbt.",
  approved: "Added as a teammate. They'll get an email to say so.",
  declined: "Declined. Nothing changes on your exhbt.",
  full: `An exhbt can have ${TEAMMATES_PER_EXHBT} teammates, counting invites still open. Remove someone first.`,
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ said?: string }> };

/**
 * An exhbt's teammates, for its owner (decision 0013): requests to join from a file match,
 * the people on it, invites waiting, and a form to invite someone. Anyone else gets a 404.
 */
export default async function TeamPage({ params, searchParams }: Params) {
  if (!isPhase2Enabled()) notFound();
  const { id } = await params;
  const { said } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exhbts/${id}/team`)}`);
  const store = getStore();
  const exhbt = await store.getExhbt(id);
  if (!exhbt || exhbt.userId !== user.id) notFound();

  const host = (await headers()).get("host");
  const [members, invites, requests, root] = await Promise.all([
    membersOf(id, host),
    store.listInvites(id),
    joinRequestsFor(user.id, id),
    exhbt.teamOf ? store.getExhbt(exhbt.teamOf) : null,
  ]);
  const rootOwner = root ? await displayNameFor(root.userId, "someone") : null;
  const used = members.length + invites.length;
  const title = titleOf(exhbt);
  const back = (await portfolioKind(await isAdmin(user))) === "page" ? { href: `/exhbts/${id}/edit`, text: "Back to the exhbt" } : { href: "/exhbts", text: "Your exhbts" };

  return (
    <div className="bg-mist">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 lg:pt-14">
        {/* Portfolio first (decision 0031): the exhbts list has gone, so the way back is to this exhbt's editor. */}
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> {back.text}
        </Link>
        <h1 className="mt-3">Teammates</h1>
        <p className="mt-1 font-semibold break-words">{title}</p>
        <p className="mt-3 max-w-[40rem] text-graphite">
          Add the people you did this project with. When it&apos;s live, their photo, name and role show under yours, linked to their
          portfolio if they have one. They&apos;re a byline, so they don&apos;t count towards your word limit.
        </p>
        {rootOwner && (
          <p className="mt-3 max-w-[40rem] text-graphite">
            This is your own exhbt, made from {rootOwner}&apos;s team project. Their team shows on it while you&apos;re on that project.
          </p>
        )}
        {said && SAID[said] && (
          <p role="status" data-said className="mt-4 rounded-[14px] border border-line bg-surface px-4 py-3">
            {SAID[said]}
          </p>
        )}

        {requests.length > 0 && (
          <section aria-labelledby="requests" className="mt-8 rounded-[20px] border border-ink bg-surface p-5 sm:p-6">
            <h2 id="requests" className="text-[1.375rem]">
              Asked to join
            </h2>
            <p className="mt-2 text-graphite">
              They uploaded a file that&apos;s also on this exhbt and say they worked on it with you. They can&apos;t see who you are unless you add them.
            </p>
            <ul className="mt-4 space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-[16px] border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{r.name}</p>
                    {r.email && <p className="text-sm break-words text-graphite">{r.email}</p>}
                    {r.role && <p className="mt-0.5 text-sm">Their part: {r.role}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <form action={decideAction.bind(null, id, r.id, true)}>
                      <Button type="submit" size="sm" variant="ink" label={`Add ${r.name} as a teammate`}>
                        Add as teammate
                      </Button>
                    </form>
                    <form action={decideAction.bind(null, id, r.id, false)}>
                      <Button type="submit" size="sm" label={`Decline ${r.name}'s request`}>
                        Decline
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="members" className="mt-8 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="members" className="text-[1.375rem]">
              On this exhbt
            </h2>
            <p className="text-sm text-graphite">
              <span className="font-mono text-ink">{used}</span> of <span className="font-mono text-ink">{TEAMMATES_PER_EXHBT}</span> places used, counting
              invites
            </p>
          </div>
          {members.length === 0 ? (
            <p className="mt-3 text-graphite">No teammates yet.</p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label="Teammates">
              {members.map((m) => (
                <li key={m.userId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={m.name} photoUrl={m.photoUrl} size={36} />
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{m.name}</p>
                      {m.role && <p className="text-sm text-graphite">{m.role}</p>}
                    </div>
                  </div>
                  <ConfirmAction
                    label="Remove"
                    accessibleLabel={`Remove ${m.name}`}
                    variant="danger"
                    question="Take them off this exhbt?"
                    confirmLabel="Yes, remove"
                    action={removeTeammateAction.bind(null, id, m.userId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {invites.length > 0 && (
          <section aria-labelledby="invites" className="mt-6 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
            <h2 id="invites" className="text-[1.375rem]">
              Waiting to accept
            </h2>
            <ul className="mt-4 space-y-3">
              {invites.map((inv) => {
                const expired = Date.parse(inv.expiresAt) < Date.now();
                return (
                  <li key={inv.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{inv.email}</p>
                      <p className="text-sm text-graphite">
                        {inv.role ? `${inv.role} · ` : ""}
                        {expired ? "The link has expired" : `The link works until ${day(inv.expiresAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <form action={resendInviteAction.bind(null, id, inv.id)}>
                        <Button type="submit" size="sm" label={`Resend the invite to ${inv.email}`}>
                          Resend
                        </Button>
                      </form>
                      <form action={cancelInviteAction.bind(null, id, inv.id)}>
                        <Button type="submit" size="sm" label={`Cancel the invite to ${inv.email}`}>
                          Cancel
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="invite" className="mt-6 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          <h2 id="invite" className="text-[1.375rem]">
            Invite a teammate
          </h2>
          {used >= TEAMMATES_PER_EXHBT ? (
            <p className="mt-2 text-graphite">
              Every place is taken. Cancel an invite or remove someone to invite another person.
            </p>
          ) : (
            <>
              <p className="mt-2 text-graphite">
                We email them a link that works for {INVITE_DAYS} days. They sign in with that address to accept, and can leave at any time.
              </p>
              <InviteForm exhbtId={id} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
