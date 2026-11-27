"use client";

import Link from "next/link";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { CopyLink } from "@/components/ui/CopyLink";
import type { Plan } from "@/lib/entitlements";
import { portfolioHost } from "@/lib/hosts";
import type { BuilderPlan } from "./steps";
import { UsernameForm } from "./UsernameForm";
import { Tick } from "@/components/ui/Tick";

/**
 * Step 4, Publish and share: the address (a username, on a paid plan: canClaimUsername), the link to
 * copy, and a plain account of what visitors see now. Exhbts are published one at a time from the
 * editor, where their checks run; this step says what's live and where to go for the rest.
 */
export function StepPublish({
  username,
  viewHref,
  addressBlocked,
  plan,
  counts,
  hideFromSearch,
  setHideFromSearch,
  ready,
}: {
  username: string | null;
  viewHref: string | null;
  addressBlocked: { reason: string; upgradeTo?: Plan } | null;
  plan: BuilderPlan;
  counts: { live: number; hidden: number; drafts: number };
  hideFromSearch: boolean;
  setHideFromSearch: (on: boolean) => void;
  ready: boolean;
}) {
  const online = Boolean(username) && plan.isPublic && counts.live > 0;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const checks = [
    { done: Boolean(username), text: username ? `Your address is ${portfolioHost(username)}` : "Choose your address" },
    { done: counts.live > 0, text: counts.live > 0 ? `${plural(counts.live, "exhbt is", "exhbts are")} on your portfolio` : "Publish an exhbt from the editor" },
    { done: plan.isPublic, text: plan.isPublic ? `Your portfolio is public on ${plan.name}` : `Your portfolio goes public on a paid plan` },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="address-heading">
        <h3 id="address-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
          Your address
        </h3>
        <UsernameForm current={username} blocked={addressBlocked} />
      </section>

      <section aria-labelledby="live-heading">
        <h3 id="live-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
          {online ? "Your portfolio is live" : "Before your portfolio goes live"}
        </h3>
        <ul className="mt-3 space-y-2.5" data-testid="publish-checklist">
          {checks.map((c) => (
            <li key={c.text} className="flex items-start gap-2.5" data-done={c.done ? "true" : undefined}>
              {c.done ? (
                <Tick className="mt-0.5" />
              ) : (
                <span aria-hidden className="mt-0.5 inline-flex size-5 shrink-0 rounded-full border border-field bg-surface" />
              )}
              <span>
                <span className="sr-only">{c.done ? "Done: " : "To do: "}</span>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
        {(counts.hidden > 0 || counts.drafts > 0) && (
          <p className="mt-4 text-sm text-graphite">
            {[counts.hidden > 0 && `${plural(counts.hidden, "exhbt is", "exhbts are")} hidden from your portfolio`, counts.drafts > 0 && `${plural(counts.drafts, "draft isn’t", "drafts aren’t")} published yet`]
              .filter(Boolean)
              .join(", and ")}
            .{" "}
            <Link href="/exhbts" className="link font-semibold text-ink">
              Your exhbts
            </Link>
          </p>
        )}
        {!plan.isPublic && plan.publishNote && <UpgradePrompt className="mt-4" reason={plan.publishNote.reason} upgradeTo={plan.publishNote.upgradeTo} primary={false} />}
      </section>

      {username && viewHref && (
        <section aria-labelledby="share-heading">
          <h3 id="share-heading" className="text-[1.0625rem] font-sans font-semibold tracking-normal">
            Share it
          </h3>
          <p className="mt-2 break-all">
            <a href={viewHref} className="link font-semibold">
              {portfolioHost(username)}
            </a>
          </p>
          <div className="mt-3">
            <CopyLink href={viewHref} size="sm" />
          </div>
        </section>
      )}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={hideFromSearch}
          disabled={!ready}
          onChange={(e) => setHideFromSearch(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-[var(--color-jade)]"
        />
        <span>
          Hide my portfolio from search engines
          <span className="block text-sm text-graphite">People with the link can still open it.</span>
        </span>
      </label>
    </div>
  );
}
