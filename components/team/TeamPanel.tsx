import type { ReactNode } from "react";
import { leaveAction, makeOwnAction } from "@/app/(app)/team/actions";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { joinRequestsFor } from "@/lib/duplicates";
import { canCreateExhbt, getPlan } from "@/lib/plan";
import { getStore } from "@/lib/store";
import { membershipsFor } from "@/lib/team";

/*
 * The team side of a person's exhbts: the requests to join one of theirs, and the projects they're on as a
 * teammate. Moved out of the exhbts list (app/(app)/exhbts/page.tsx) with no change in what it draws, so the
 * list and the portfolio editor's Team sheet show the same thing (decision 0031, "Where each thing the
 * exhbts list did goes").
 */

/** What just happened on a team project, from the query string (app/(app)/team/actions.ts). */
export const TEAM_SAID: Record<"joined" | "left", string> = {
  joined: "You're on the team. The project shows below.",
  left: "You've left the project. Your own exhbt made from it, if you made one, is still yours.",
};

/** "Someone asked to join your exhbt": each request with Review. Draws nothing when there is none. */
export async function JoinRequests({ userId }: { userId: string }): Promise<ReactNode> {
  const requests = await joinRequestsFor(userId);
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="join-requests" className="mt-6 rounded-[20px] border border-ink bg-surface p-5 sm:p-6">
      <h2 id="join-requests" className="text-[1.375rem]">
        {requests.length === 1 ? "Someone asked to join your exhbt" : "People asked to join your exhbts"}
      </h2>
      <ul className="mt-3 space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="font-semibold">{r.name}</span> asked to join <span className="font-semibold">{r.title}</span>
            </span>
            <Button href={`/exhbts/${r.exhbtId}/team`} size="sm" label={`Review ${r.name}'s request`}>
              Review
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type TeamProps = { userId: string; host: string | null; said: "joined" | "left" | null; full: boolean };

/**
 * "Team projects": the projects the person is on as a teammate, with today's buttons and server actions
 * (Open your own exhbt, Make my own exhbt from this project, View, Leave). `said` is today's note after
 * joining or leaving; `full` is today's upgrade prompt after a refused Make my own. Draws nothing when the
 * person is on no team project and `said` is null.
 */
export async function TeamProjects({ userId, host, said, full }: TeamProps): Promise<ReactNode> {
  const [plan, exhbts, memberships] = await Promise.all([getPlan(userId), getStore().listExhbts(userId), membershipsFor(userId, host)]);
  if (memberships.length === 0 && !said) return null;
  const room = canCreateExhbt(plan, exhbts);
  return (
    <>
      {said && (
        <p role="status" data-said className="mt-8 rounded-[14px] border border-line bg-surface px-4 py-3">
          {TEAM_SAID[said]}
        </p>
      )}
      {memberships.length > 0 && (
        <section id="team-projects" aria-labelledby="team-projects-title" className="mt-10">
          <h2 id="team-projects-title" className="text-[1.375rem]">
            Team projects
          </h2>
          <p className="mt-1 text-graphite">Other people&apos;s exhbts you&apos;re on as a teammate. Your name shows on them when they&apos;re live.</p>
          {full && !room.ok && <UpgradePrompt className="mt-3" reason={room.reason} upgradeTo={room.upgradeTo} tone="alert" />}
          <ul className="mt-4 space-y-3" aria-label="Team projects you're on">
            {memberships.map((m) => (
              <li key={m.rootId} className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{m.title}</p>
                  <p className="text-sm text-graphite">
                    {m.ownerName}&apos;s exhbt{m.role ? ` · Your part: ${m.role}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.ownId ? (
                    <Button href={`/exhbts/${m.ownId}/edit`} size="sm" label={`Open your own exhbt of ${m.title}`}>
                      Open your own exhbt
                    </Button>
                  ) : room.ok ? (
                    <form action={makeOwnAction.bind(null, m.rootId)}>
                      <Button type="submit" size="sm" label={`Make my own exhbt from ${m.title}`}>
                        Make my own exhbt from this project
                      </Button>
                    </form>
                  ) : (
                    <span className="text-sm text-graphite">Your plan is full, so you can&apos;t make your own exhbt of this yet.</span>
                  )}
                  {m.liveHref && (
                    <Button href={m.liveHref} size="sm" label={`View ${m.title}`}>
                      View
                    </Button>
                  )}
                  <ConfirmAction
                    label="Leave"
                    accessibleLabel={`Leave ${m.title}`}
                    question="Take your name off it?"
                    confirmLabel="Yes, leave"
                    action={leaveAction.bind(null, m.rootId)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Both, requests first: what the editor's Team sheet shows. */
export async function TeamPanel(props: TeamProps): Promise<ReactNode> {
  return (
    <>
      <JoinRequests userId={props.userId} />
      <TeamProjects {...props} />
    </>
  );
}
