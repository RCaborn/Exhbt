import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import { readInvite, titleOf } from "@/lib/team";
import { AcceptForm } from "./AcceptForm";

export const metadata: Metadata = { title: "Join a team project", robots: { index: false } };
export const dynamic = "force-dynamic";

/** "ana@uni.ac.uk" → "a••@uni.ac.uk": enough to recognise the address without showing it whole. */
const masked = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
};

/**
 * Where an invite email's button lands (decision 0013). Joining needs the person signed in with
 * the address the invite went to, through the usual sign-in link; then one button, so a mail
 * scanner that opens the link never joins anyone.
 */
export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (!isPhase2Enabled()) notFound();
  const { token } = await searchParams;
  const [view, user] = await Promise.all([readInvite(token), getCurrentUser()]);
  const here = `/team/accept?token=${encodeURIComponent(token ?? "")}`;
  const login = `/login?next=${encodeURIComponent(here)}`;

  const card = (body: React.ReactNode) => (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <div className="mx-auto max-w-[36rem] rounded-[24px] border border-line bg-surface p-6 shadow-pack sm:p-10">{body}</div>
    </div>
  );

  if (view.state === "invalid" || view.state === "cancelled") {
    return card(
      <>
        <h1 className="text-[2rem]">This invite link doesn&apos;t work</h1>
        <p className="mt-3 text-graphite">
          It may have been cancelled, or sent again with a new link. Ask whoever invited you to send it again.
        </p>
      </>,
    );
  }
  const title = titleOf(view.exhbt);
  const summary = (
    <p className="mt-3 text-graphite">
      {view.ownerName} invited you to <span className="font-semibold text-ink">{title}</span>
      {view.invite.role ? (
        <>
          {" "}
          as <span className="font-semibold text-ink">{view.invite.role}</span>
        </>
      ) : null}
      .
    </p>
  );

  if (view.state === "expired") {
    return card(
      <>
        <h1 className="text-[2rem]">This invite has expired</h1>
        {summary}
        <p className="mt-3 text-graphite">Ask {view.ownerName} to send it again from their exhbt&apos;s Teammates page.</p>
      </>,
    );
  }
  const member = user ? (await getStore().listMembers(view.exhbt.id)).some((m) => m.userId === user.id) : false;
  if (view.state === "used" || member) {
    return card(
      <>
        <h1 className="text-[2rem]">{member ? "You're on this project" : "This invite has been used"}</h1>
        {summary}
        {member && (
          <div className="mt-6">
            <Button href="/exhbts#team-projects" variant="primary">
              Go to your exhbts
            </Button>
          </div>
        )}
      </>,
    );
  }

  if (!user) {
    return card(
      <>
        <h1 className="text-[2rem]">Join a team project</h1>
        {summary}
        <p className="mt-3 text-graphite">Sign in with {masked(view.invite.email)} to accept. We email you a link; there&apos;s no password.</p>
        <div className="mt-6">
          <Button href={login} variant="primary">
            Sign in to accept
          </Button>
        </div>
      </>,
    );
  }
  if (user.email.toLowerCase() !== view.invite.email.toLowerCase()) {
    return card(
      <>
        <h1 className="text-[2rem]">This invite is for another address</h1>
        {summary}
        <p className="mt-3 text-graphite">
          It went to {masked(view.invite.email)}, and you&apos;re signed in as {user.email}. Sign in with the address it went to, then open the
          link again.
        </p>
        <div className="mt-6">
          <Button href={login}>Sign in with that address</Button>
        </div>
      </>,
    );
  }

  const profile = await getStore().getPortfolioProfile(user.id);
  return card(
    <>
      <h1 className="text-[2rem]">Join a team project</h1>
      {summary}
      <p className="mt-3 text-graphite">
        Your photo, name and role show on the project when it&apos;s published, linked to your portfolio if you have one. You can leave at any
        time, and you can make your own exhbt from the project.
      </p>
      <AcceptForm token={token!} name={profile.name?.trim() ?? ""} />
    </>,
  );
}
