/**
 * The finish screen's states (/lab/design/finish?state=…): the moments a publish can end on, and the
 * wait before the first draft. Plain data, for the page (server) and the stage (browser).
 */
export const FINISH_STATES = [
  {
    id: "first",
    tab: "First publish",
    note: "Amara is on a paid plan and has just published this exhbt for the first time. Play it again to see it from Review and publish.",
  },
  {
    id: "changes",
    tab: "Publishing changes",
    note: "The exhbt is already live and she publishes an edit. No ceremony the second time: a toast, and the page.",
  },
  {
    id: "free",
    tab: "On Free",
    note: "On Free an exhbt is saved as a draft only its owner can see. The moment says so, and offers the upgrade once. Close it to play it again.",
  },
  {
    id: "portfolio",
    tab: "Back on the portfolio",
    note: "After a first publish she lands back on her portfolio, where the tile she published turns from Draft to Live.",
  },
  {
    id: "drafting",
    tab: "Writing the draft",
    note: "Before any of this: about 20 seconds while the first draft is written from her files.",
  },
] as const;

export type FinishState = (typeof FINISH_STATES)[number]["id"];
export const isFinishState = (v: unknown): v is FinishState => FINISH_STATES.some((s) => s.id === v);
export const stateOf = (id: FinishState) => FINISH_STATES.find((s) => s.id === id)!;
