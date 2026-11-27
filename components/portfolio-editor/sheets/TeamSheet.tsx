"use client";

import { useEffect, type ReactNode } from "react";
import { Users } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@/components/ui/Button";
import { usePortfolioApi, usePortfolioData, usePortfolioUi } from "../runtime";
import { Sheet } from "../ui/Sheet";

/*
 * Team (decision 0031, "What is edited where": Team). The bar's menu opens this sheet with the panel the
 * server drew (`team`: H's TeamPanel, with its own server actions: the requests to join one of the
 * person's exhbts, then the projects they are on as a teammate). When the panel draws nothing, an empty
 * state says what team projects are. A notice under the bar says when someone is waiting for an answer.
 */

export const TEAM_WORDS = {
  title: "Team projects",
  lead: "When you made a project with other people, each of you can have an exhbt of it. Requests to join yours, and the projects you are on, are here.",
  emptyTitle: "No team projects yet",
  empty: "When a teammate adds you to a project, or asks to join one of your exhbts, it shows here.",
  notice: "Someone asked to join one of your exhbts",
};

export function TeamSheet({ team }: { team: ReactNode }): ReactNode {
  return (
    <Sheet name="team" title={TEAM_WORDS.title} width={520}>
      <div className="pe-sheet-body" data-team-sheet>
        <Text type="body" className="pe-sheet-lead">
          {TEAM_WORDS.lead}
        </Text>
        <div className="pe-team">{team}</div>
        <div className="pe-team-empty">
          <EmptyState isCompact icon={<Users aria-hidden size={28} strokeWidth={1.75} />} title={TEAM_WORDS.emptyTitle} description={TEAM_WORDS.empty} />
        </div>
      </div>
    </Sheet>
  );
}

/** The notice under the bar while someone waits for an answer: Review opens the Team sheet. */
export function TeamNotice(): ReactNode {
  const waiting = usePortfolioData().teamRequests;
  const api = usePortfolioApi();
  const open = usePortfolioUi((u) => u.sheet === "team");
  // Seen in the Banner, and heard once through the live region: a Banner is not live by itself.
  useEffect(() => {
    if (waiting > 0) api.say(TEAM_WORDS.notice + ".");
  }, [waiting, api]);
  if (waiting <= 0) return null;
  return (
    <div data-team-notice>
      <Banner
        status="info"
        container="section"
        title={TEAM_WORDS.notice}
        endContent={
          <Button size="sm" aria-expanded={open} onClick={(e) => api.open("team", e.currentTarget as HTMLElement)}>
            Review
          </Button>
        }
      />
    </div>
  );
}
