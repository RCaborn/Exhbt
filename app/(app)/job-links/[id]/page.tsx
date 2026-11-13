import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { EXHBTS_PER_JOB_LINK, PLAN_NAMES } from "@/lib/entitlements";
import { portfolioUrl } from "@/lib/hosts";
import { pickableExhbts } from "@/lib/job-links";
import { INTRO_MAX_CHARS, INTRO_WORDS } from "@/lib/jobs/rank";
import { getPlan, limitsFor } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore } from "@/lib/store";
import {
  deleteJobLink,
  moveJobLinkPick,
  removeJobLinkPick,
  saveJobLinkIntro,
  setJobLinkSlugStyle,
  setJobLinkStatus,
  swapJobLinkPick,
} from "../actions";

export const metadata: Metadata = { title: "Edit job link", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> };

const ERRORS: Record<string, string> = {
  plan: `Changing job links comes with ${PLAN_NAMES.max}. You can still turn this one off or delete it.`,
  limit: "You have as many live links as your plan allows. Turn another one off first.",
  intro: `Keep the intro to about ${INTRO_WORDS} words.`,
};

/** One job link: the picks in order with their reasons, the intro, the address, on or off. */
export default async function JobLinkEditPage({ params, searchParams }: Props) {
  if (!isPhase2Enabled()) notFound();
  const { id } = await params;
  const { saved, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/job-links/${id}`);
  const store = getStore();
  const link = await store.getJobLink(id);
  if (!link || link.userId !== user.id) notFound();
  const [plan, live, profile] = await Promise.all([getPlan(user.id), pickableExhbts(user.id), store.getPortfolioProfile(user.id)]);
  const canEdit = limitsFor(plan).jobLinks;
  const byId = new Map(live.map((e) => [e.id, e]));
  const title = (exhbtId: string) => byId.get(exhbtId)?.published?.title ?? "An exhbt that is no longer live";
  const unpicked = live.filter((e) => !link.picks.some((p) => p.exhbtId === e.id));
  const name = [link.company, link.roleTitle].filter(Boolean).join(" · ");
  const isLive = link.status === "live";

  return (
    <div className="bg-mist">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 lg:pt-14">
        <Link href="/job-links" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> Job links
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="break-words">{name}</h1>
          <span className={isLive ? "chip" : "chip bg-mist text-graphite"}>{isLive ? "Live" : "Off"}</span>
        </div>
        <p className="mt-2 text-sm text-graphite">{link.viewCount === 1 ? "1 view" : `${link.viewCount.toLocaleString("en-GB")} views`}. Views are counted without cookies.</p>

        {error && ERRORS[error] && (
          <p role="alert" className="mt-6 rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
            {ERRORS[error]}{" "}
            {error === "plan" && (
              <Link href="/account/billing" className="link font-semibold">
                See plans
              </Link>
            )}
          </p>
        )}

        <section aria-labelledby="address" className="mt-8 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          <h2 id="address" className="text-[1.375rem]">Address</h2>
          {profile.username ? (
            <>
              <p className="mt-2 font-mono break-all" data-testid="job-link-address">
                {portfolioUrl(profile.username, link.slug)}
              </p>
              {process.env.NODE_ENV !== "production" && (
                <p className="mt-1 font-mono text-sm break-all text-graphite">
                  In development: /p/{profile.username}/{link.slug}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2">
              Choose your username to get an address.{" "}
              <Link href="/account/portfolio" className="link font-semibold">
                Portfolio settings
              </Link>
            </p>
          )}
          <p className="mt-2 text-sm text-graphite">
            {link.slugStyle === "suffix"
              ? "It ends in a short code, so nobody can guess it."
              : "It's the clean style: anyone could find it by trying company names."}{" "}
            Search engines never list it.
          </p>
          {saved === "address" && (
            <p role="status" className="mt-2 text-sm font-semibold">
              Address changed. The old one no longer works.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {canEdit && (
              <form action={setJobLinkSlugStyle.bind(null, link.id, link.slugStyle === "suffix" ? "clean" : "suffix")}>
                <Button type="submit" size="sm">
                  {link.slugStyle === "suffix" ? "Use a clean address" : "Use an address with a code"}
                </Button>
              </form>
            )}
            {profile.username && (
              <Button href={`/job-links/${link.id}/preview`} size="sm">
                Preview the page
              </Button>
            )}
            <form action={setJobLinkStatus.bind(null, link.id, isLive ? "off" : "live")}>
              <Button type="submit" size="sm">
                {isLive ? "Turn off" : "Turn on"}
              </Button>
            </form>
          </div>
        </section>

        <section aria-labelledby="picks" className="mt-6 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          <h2 id="picks" className="text-[1.375rem]">Your picks</h2>
          <p className="mt-2 text-graphite">In the order the employer sees them. The reasons are for you; the page doesn&apos;t show them.</p>
          {link.picks.length === 0 ? (
            <p className="mt-4">No exhbts picked. Add one below.</p>
          ) : (
            <ol aria-label="Picks, in order" className="mt-4 space-y-3">
              {link.picks.map((p, i) => {
                const t = title(p.exhbtId);
                const others = unpicked;
                return (
                  <li key={p.exhbtId} className="rounded-[16px] border border-line p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-graphite">{i + 1}</span>
                        <p className="font-semibold break-words">{t}</p>
                        <p className="mt-1 text-sm text-graphite">{p.reason || "Added by you."}</p>
                        {!byId.has(p.exhbtId) && <p className="mt-1 text-sm text-error">It isn&apos;t live, so the page leaves it out.</p>}
                      </div>
                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:flex-nowrap">
                          <form action={moveJobLinkPick.bind(null, link.id, p.exhbtId, -1)}>
                            <Button type="submit" size="sm" disabled={i === 0} label={`Move ${t} up`}>
                              <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
                            </Button>
                          </form>
                          <form action={moveJobLinkPick.bind(null, link.id, p.exhbtId, 1)}>
                            <Button type="submit" size="sm" disabled={i === link.picks.length - 1} label={`Move ${t} down`}>
                              <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
                            </Button>
                          </form>
                          <form action={removeJobLinkPick.bind(null, link.id, p.exhbtId)}>
                            <Button type="submit" size="sm" label={`Remove ${t}`}>
                              Remove
                            </Button>
                          </form>
                        </div>
                      )}
                    </div>
                    {canEdit && others.length > 0 && (
                      <form action={swapJobLinkPick.bind(null, link.id, p.exhbtId)} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label htmlFor={`swap-${p.exhbtId}`} className="text-sm font-semibold sm:shrink-0">
                          Swap for
                        </label>
                        <select id={`swap-${p.exhbtId}`} name="to" className="field py-1.5 text-sm">
                          {others.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.published?.title}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" label={`Swap ${t}`}>
                          Swap
                        </Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {canEdit && link.picks.length < EXHBTS_PER_JOB_LINK && unpicked.length > 0 && (
            <form action={swapJobLinkPick.bind(null, link.id, null)} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="add-pick" className="text-sm font-semibold sm:shrink-0">
                Add an exhbt
              </label>
              <select id="add-pick" name="to" className="field py-1.5 text-sm">
                {unpicked.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.published?.title}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          )}
        </section>

        <section aria-labelledby="intro-h" className="mt-6 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          <h2 id="intro-h" className="text-[1.375rem]">Intro</h2>
          <form action={saveJobLinkIntro.bind(null, link.id)} className="mt-2">
            <label htmlFor="intro" className="hint block">
              A line or two to the employer, in your words. About {INTRO_WORDS} words. We suggested this from the advert and your exhbts.
            </label>
            <textarea id="intro" name="intro" rows={3} maxLength={INTRO_MAX_CHARS} defaultValue={link.intro} disabled={!canEdit} className="field mt-2" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {canEdit && (
                <Button type="submit" size="sm">
                  Save intro
                </Button>
              )}
              {saved === "intro" && (
                <span role="status" className="text-sm font-semibold">
                  Saved
                </span>
              )}
            </div>
          </form>
        </section>

        <section aria-labelledby="delete-h" className="mt-6 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
          <h2 id="delete-h" className="text-[1.375rem]">Delete</h2>
          <p className="mt-2 text-graphite">The address stops working. Your exhbts stay as they are.</p>
          <div className="mt-3">
            <ConfirmAction
              label="Delete link"
              accessibleLabel={`Delete the link for ${name}`}
              variant="danger"
              question="Delete this link for good?"
              confirmLabel="Yes, delete"
              action={deleteJobLink.bind(null, link.id)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
