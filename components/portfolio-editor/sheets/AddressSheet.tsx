"use client";

import { useState, type ReactNode } from "react";
import { Check, Circle } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { UsernameForm } from "@/app/(app)/portfolio/UsernameForm";
import { Button } from "@/components/ui/Button";
import { CopyLink } from "@/components/ui/CopyLink";
import { portfolioHost } from "@/lib/hosts";
import { useListedLive } from "../bar/hooks";
import { usePortfolioApi, usePortfolioData, usePortfolioState } from "../runtime";
import { Sheet } from "../ui/Sheet";

/*
 * The address sheet (decision 0031, "Address, share, hide from search"; `open("address")`, the bar's
 * "Claim your address" or "Share"). On a plan that can claim: the step builder's own UsernameForm, as it
 * is (its live check, its hourly limit, its 30-day redirect; never autosaved), then the address with
 * Copy link, Change and "Hide from search", then what is still to do before the page is online. Where
 * the plan cannot claim, its reason and the upgrade. A claim revalidates /portfolio on the server
 * (claimUsernameAction), so the new address arrives in the editor's data by itself.
 */

/** The sheet's title and first line, by where the person stands: the words a stranger reads first. */
export const ADDRESS_WORDS = {
  title: "Your address",
  claim: `Your address is where your portfolio lives online, like ${portfolioHost("your-name")}. You send it with applications and put it on your CV.`,
  share: "Where your portfolio lives online. Send it with applications and put it on your CV.",
  blocked: (plan: string) =>
    `On ${plan} your portfolio is a preview only you can see. A paid plan gives you your own address and lets you publish exhbts to it, so employers can see them.`,
  notFound: "Your address shows “not found” until you publish an exhbt.",
};

export function AddressSheet(): ReactNode {
  const data = usePortfolioData();
  const { username, addressBlocked } = data.builder;
  const title = username && !addressBlocked ? "Share your portfolio" : ADDRESS_WORDS.title;
  return (
    <Sheet name="address" title={title} purpose="form" width={480}>
      <AddressBody />
    </Sheet>
  );
}

function AddressBody(): ReactNode {
  const data = usePortfolioData();
  const api = usePortfolioApi();
  const { username, addressBlocked, viewHref, plan } = data.builder;
  const hide = usePortfolioState((s) => s.profile.hideFromSearch ?? false);
  const live = useListedLive();
  const [changing, setChanging] = useState(false);

  if (addressBlocked) {
    return (
      <div className="pe-sheet-body" data-address="blocked">
        <Text type="body" className="pe-sheet-lead">
          {ADDRESS_WORDS.blocked(plan.name)}
        </Text>
        <UsernameForm current={username} blocked={addressBlocked} />
      </div>
    );
  }

  if (!username) {
    return (
      <div className="pe-sheet-body" data-address="claim">
        <Text type="body" className="pe-sheet-lead">
          {ADDRESS_WORDS.claim}
        </Text>
        <UsernameForm current={null} />
        <Checklist />
      </div>
    );
  }

  return (
    <div className="pe-sheet-body" data-address="share">
      <Text type="body" className="pe-sheet-lead">
        {ADDRESS_WORDS.share}
      </Text>
      <section className="pe-sheet-part" aria-labelledby="pe-address-h">
        <h3 id="pe-address-h">Your address</h3>
        <p className="pe-address" data-address-host>
          {viewHref ? (
            <a href={viewHref} className="link" target="_blank" rel="noreferrer">
              {portfolioHost(username)}
            </a>
          ) : (
            portfolioHost(username)
          )}
        </p>
        {live === 0 && <Banner status="warning" title={ADDRESS_WORDS.notFound} description="Add an exhbt and publish it, and your page is online." />}
        <span className="pe-bar-end">
          {viewHref && <CopyLink href={viewHref} size="sm" />}
          <Button size="sm" aria-expanded={changing} aria-controls="pe-address-change" onClick={() => setChanging((c) => !c)}>
            Change
          </Button>
        </span>
        {changing && (
          <div id="pe-address-change">
            <UsernameForm current={username} />
          </div>
        )}
      </section>
      <Switch
        label="Hide from search"
        description="Search engines leave your portfolio out. People with the link can still open it."
        value={hide}
        onChange={(on) => api.change((s) => ({ ...s, profile: { ...s.profile, hideFromSearch: on } }), on ? "hid your portfolio from search" : "showed your portfolio to search")}
      />
      <Checklist />
    </div>
  );
}

/** What is still to do before visitors can see the page, as the step builder's Publish step lists it. */
function Checklist(): ReactNode {
  const { username, plan } = usePortfolioData().builder;
  const live = useListedLive();
  const online = Boolean(username) && plan.isPublic && live > 0;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const checks = [
    { done: Boolean(username), text: username ? `Your address is ${portfolioHost(username)}` : "Choose your address" },
    { done: live > 0, text: live > 0 ? `${plural(live, "exhbt is", "exhbts are")} on your page` : "Add an exhbt and publish it" },
    { done: plan.isPublic, text: plan.isPublic ? `Your page is public on ${plan.name}` : "Pages go public on a paid plan" },
  ];
  return (
    <section className="pe-sheet-part" aria-labelledby="pe-live-h">
      <h3 id="pe-live-h">{online ? "Your page is online" : "Before your page goes online"}</h3>
      <ul className="pe-checks" data-testid="publish-checklist">
        {checks.map((c) => (
          <li key={c.text} className="pe-check" data-done={c.done ? "true" : undefined}>
            {c.done ? <Check aria-hidden size={18} strokeWidth={2.5} className="pe-check-mark" /> : <Circle aria-hidden size={18} strokeWidth={2} className="pe-check-mark" />}
            <span>
              <span className="sr-only">{c.done ? "Done: " : "To do: "}</span>
              {c.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
