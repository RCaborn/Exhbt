import { BILLING_PERIOD, ENTITLEMENTS, PLAN_NAMES, PRICES, type Plan } from "@/lib/entitlements";
import { demoExhbts, demoOwner, demoPortfolio } from "@/lib/exhbt";
import { APP_HOST, portfolioHost, portfolioUrl } from "@/lib/hosts";
import { canClaimUsername, canCreateExhbt, canPublish } from "@/lib/plan-rules";
import type { ExhbtRecord } from "@/lib/store";

/**
 * Everything the App screen says that is a fact about the product or the person: the plan's
 * figures, names and reasons from lib/entitlements.ts and lib/plan-rules.ts, her address from
 * lib/hosts.ts, her exhbts from the demo (lib/exhbt.ts). Built on the server and handed to the
 * screen as plain data, so no figure is typed into prose and none can drift from the product.
 */

/** The plan each state of the screen is on: a new account is on Free; with four exhbts she is on Max. */
const FIRST_RUN_PLAN: Plan = "free";
const WORK_PLAN: Plan = "max";

/**
 * Her four exhbts in her portfolio's order. Owner-only tiles come after the live ones (decision
 * 0031), so the draft is last. A draft has no link of its own until it is published.
 */
const WORK: { slug: string; status: TileStatus }[] = [
  { slug: "gp-reminders", status: "live" },
  { slug: "ae-forecast", status: "live" },
  { slug: "study-habits", status: "live" },
  { slug: "bed-dashboard", status: "draft" },
];

export type TileStatus = "live" | "draft";
export type TileWords = {
  slug: string;
  title: string;
  status: TileStatus;
  /** Its own link (name.exhbt.co.uk/slug) once live; null for a draft. */
  link: string | null;
  /** The made-up person's real public page for it, on this site. */
  viewHref: string;
};

export type PlanWords = {
  id: "free" | "premium" | "max";
  name: string;
  /** "£15 a year", or "£0". */
  price: string;
  /** What the plan holds, in two or three short lines. */
  lines: string[];
  /** What changes if she moves to it. */
  change: string;
};

export type AppWords = {
  person: {
    name: string;
    first: string;
    email: string;
    username: string;
    /** amara.exhbt.co.uk */
    host: string;
    initials: string;
    headline: string;
  };
  /** Where a page with no address is edited: only its owner can open it. */
  ownerUrl: string;
  /** An example exhbt's address, for the empty state's picture. */
  exampleUrl: string;
  firstRun: {
    plan: string;
    /** "On Free, your exhbt is a draft only you can see. Publishing to your own link comes with Premium." */
    draftNote: string;
    /** With all three steps done on Free: what putting the page online takes. */
    onlineNote: string;
    /** The one example exhbt the empty state pictures, and the first one she adds. */
    exampleSlug: string;
    exampleTitle: string;
  };
  work: {
    plan: string;
    used: number;
    limit: number;
    live: number;
    /** "4 of 10 on Max" (decision 0031's words for the Add tile). */
    limitLine: string;
    /** Empty while she can add another; the plan's reason when it is full. */
    fullReason: string;
    tiles: TileWords[];
  };
  account: {
    plan: Plan;
    planName: string;
    priceLine: string;
    plans: PlanWords[];
    /** How the paid plans are billed (BILLING_PERIOD). */
    billingLine: string;
  };
};

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Only what canCreateExhbt reads (how many there are), as records. */
const records = (n: number): ExhbtRecord[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `sample-${i}`,
    userId: "sample",
    doc: demoExhbts[i % demoExhbts.length]!.doc,
    published: null,
    status: "draft",
    slug: null,
    position: i,
    confirmedAt: null,
    publishedAt: null,
    updatedAt: "",
  }));

function priceOf(plan: Plan): string {
  const p = PRICES[plan] ?? "";
  return plan === "free" ? p : `${p} a ${BILLING_PERIOD}`;
}

function planLines(plan: "free" | "premium" | "max"): string[] {
  const e = ENTITLEMENTS[plan];
  const lines = e.publicPortfolio
    ? [`Up to ${count(e.exhbts, "exhbt")} online at your address`]
    : [`Build and preview ${count(e.exhbts, "exhbt")}`, "Your page is private: only you can see it"];
  if (e.jobLinks) lines.push("A link of its own for every job you apply to");
  if (e.publicPortfolio) lines.push(e.portfolioThemes === "all" ? "Every portfolio look, in every colour" : `${count(e.portfolioThemes, "portfolio look")}`);
  return lines;
}

/** What moving to `plan` changes for someone with `total` exhbts, `live` of them published. */
function changeTo(plan: "free" | "premium" | "max", total: number, live: number): string {
  const e = ENTITLEMENTS[plan];
  const name = PLAN_NAMES[plan];
  if (!e.publicPortfolio) return `On ${name} your portfolio goes offline and only you can see it. Nothing is deleted.`;
  if (live > e.exhbts) return `On ${name} your portfolio shows your first ${count(e.exhbts, "exhbt")}, in the order you set. Nothing is deleted.`;
  if (total > e.exhbts) return `${name} holds ${count(e.exhbts, "exhbt")}. Your ${live} live ones stay online, and nothing is deleted.`;
  return `${name} holds ${count(e.exhbts, "exhbt")}: all ${total} of yours fit, and your ${live} live ones stay online.`;
}

export function appWords(): AppWords {
  const name = demoOwner.name;
  const tiles: TileWords[] = WORK.map(({ slug, status }) => {
    const e = demoExhbts.find((x) => x.slug === slug)!;
    return {
      slug,
      title: e.doc.title,
      status,
      link: status === "live" ? portfolioUrl(demoOwner.username, slug) : null,
      viewHref: `/demo/${slug}`,
    };
  });
  const used = tiles.length;
  const limit = ENTITLEMENTS[WORK_PLAN].exhbts;
  const room = canCreateExhbt(WORK_PLAN, records(used));
  const publish = canPublish(FIRST_RUN_PLAN, [], "first");
  const address = canClaimUsername(FIRST_RUN_PLAN);
  const example = demoExhbts[0]!;
  return {
    person: {
      name,
      first: name.split(" ")[0]!,
      email: `${demoOwner.username}@example.com`,
      username: demoOwner.username,
      host: portfolioHost(demoOwner.username),
      initials: name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2),
      headline: demoPortfolio.person.headline,
    },
    ownerUrl: `${APP_HOST}/portfolio`,
    exampleUrl: portfolioUrl("yourname", "your-project"),
    firstRun: {
      plan: PLAN_NAMES[FIRST_RUN_PLAN],
      draftNote: `On ${PLAN_NAMES[FIRST_RUN_PLAN]}, your exhbt is a draft only you can see.${publish.ok ? "" : ` ${publish.reason}`}`,
      onlineNote: `Your page and your first exhbt are saved. Only you can see them on ${PLAN_NAMES[FIRST_RUN_PLAN]}.${address.ok ? "" : ` ${address.reason}`}`,
      exampleSlug: example.slug,
      exampleTitle: example.doc.title,
    },
    work: {
      plan: PLAN_NAMES[WORK_PLAN],
      used,
      limit,
      live: tiles.filter((t) => t.status === "live").length,
      limitLine: `${used} of ${limit} on ${PLAN_NAMES[WORK_PLAN]}`,
      fullReason: room.ok ? "" : room.reason,
      tiles,
    },
    account: {
      plan: WORK_PLAN,
      planName: PLAN_NAMES[WORK_PLAN],
      priceLine: priceOf(WORK_PLAN),
      plans: (["free", "premium", "max"] as const).map((id) => ({
        id,
        name: PLAN_NAMES[id],
        price: priceOf(id),
        lines: planLines(id),
        change: changeTo(id, used, tiles.filter((t) => t.status === "live").length),
      })),
      billingLine: `Paid plans are billed once a ${BILLING_PERIOD}. You can move to another at any time.`,
    },
  };
}
