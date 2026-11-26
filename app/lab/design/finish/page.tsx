import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Frame } from "@/components/lab/Frame";
import { FinishStage } from "@/components/lab/finish/FinishStage";
import { PersonExhbt } from "@/components/lab/finish/PersonExhbt";
import { StateTabs } from "@/components/lab/finish/StateTabs";
import { isFinishState, stateOf } from "@/components/lab/finish/states";
import { LAB_PATH } from "@/components/lab/lab";
import { exhbtOf, sample } from "@/components/lab/samples";
import { labGate, labMetadata } from "@/components/lab/server";
import { exhbtSummary } from "@/lib/exhbt/blocks";
import { headlineFor } from "@/lib/exhbt/headline";
import { liveLine } from "@/lib/exhbt/publish-words";
import { BILLING_PERIOD, PLAN_NAMES, PRICES } from "@/lib/entitlements";
import { APP_HOST, portfolioHost } from "@/lib/hosts";
import { canClaimUsername, canPublish } from "@/lib/plan-rules";
import "@/components/lab/finish/finish.css";

export const generateMetadata = labMetadata("Finish");

/** The exhbt the finish publishes: the sample person's first, the one Home pictures. */
const SLUG = "gp-reminders";

/**
 * The finish (/lab/design/finish): the moment a person publishes an exhbt, and what they see next,
 * in its setting (a stand-in for the exhbt editor, with the real page in it). One state at a time,
 * chosen by the tabs (?state=…): a first publish on a paid plan, publishing changes, Free, landing
 * back on the portfolio, and the wait while a draft is written.
 *
 * Everything a state says comes from where the product keeps it: the words after publishing from
 * lib/exhbt/publish-words.ts, the plan's name, price and reasons from lib/entitlements.ts and
 * lib/plan-rules.ts, the link preview's title and description from the same functions the exhbt
 * page's metadata uses. The person and her work are the lab's sample (components/lab/samples.tsx).
 */
export default async function LabFinish({ searchParams }: { searchParams: Promise<{ state?: string | string[] }> }) {
  labGate();
  const asked = (await searchParams).state;
  const state = isFinishState(asked) ? asked : "first";
  const e = exhbtOf(SLUG);
  const host = portfolioHost(sample.owner.username);
  const link = sample.exhbtAddress(e.slug);
  const headline = headlineFor(e.doc);
  const premium = PLAN_NAMES.premium;
  const price = PRICES.premium;
  const free = canPublish("free", [], "lab");
  const address = canClaimUsername("free");

  return (
    <main id="main" className="fin" data-fin-state={state}>
      <header className="fin-head lab-content">
        <div className="fin-head-words">
          <Heading level={1} type="display-2">
            The moment you publish.
          </Heading>
          <Text as="p" display="block" type="large" color="secondary">
            {stateOf(state).note}
          </Text>
        </div>
        <StateTabs current={state} />
      </header>

      <FinishStage
        key={state}
        state={state}
        words={{
          title: e.doc.title,
          first: sample.firstName,
          name: sample.owner.username,
          host,
          link,
          path: link.slice(host.length),
          liveLine: liveLine(false, false),
          changedLine: liveLine(true, false),
          checkedOn: e.checkedOn,
          evidence: e.doc.evidence?.label ?? null,
          viewHref: `/demo/${e.slug}`,
          portfolioHref: `${LAB_PATH}/finish?state=portfolio`,
          nextHref: `${LAB_PATH}/finish?state=drafting`,
          preview: {
            src: `${LAB_PATH}/finish/preview.png?slug=${e.slug}`,
            alt: `The link's preview picture: "${e.doc.title}"${headline ? `, ${headline.value} ${headline.label.toLowerCase()}` : ""}, by ${sample.owner.name}, on ink.`,
            // As the exhbt page's metadata gives them to LinkedIn and the rest.
            title: `${e.doc.title} · ${sample.owner.name}`,
            description: [exhbtSummary(e.doc), e.doc.context.trim()].filter(Boolean).join(" "),
          },
          free: {
            reason: free.ok ? "" : free.reason,
            address: address.ok ? "" : address.reason,
            plan: premium,
            upgrade: `Upgrade to ${premium}${price ? ` (${price} a ${BILLING_PERIOD})` : ""}`,
            exampleHost: portfolioHost("yourname"),
          },
        }}
        editorPage={<PersonExhbt slug={e.slug} stage={state === "changes" ? "live" : "draft"} className="p-4 sm:p-8 lg:p-12" />}
        livePage={
          <Frame
            url={link}
            label={`${sample.owner.name}'s exhbt, live at ${link}: the question, how she did it, what she found, and every check ticked`}
            crop="max-h-[14rem] sm:max-h-[18rem] lg:max-h-[19rem]"
            page="[zoom:0.42] sm:[zoom:0.5]"
          >
            <PersonExhbt slug={e.slug} stage="live" className="p-8" />
          </Frame>
        }
        freePage={
          <Frame
            url={`${APP_HOST}/portfolio`}
            label={`${sample.owner.name}'s exhbt as she sees it on her portfolio, a draft: nobody else can open it`}
            crop="max-h-[14rem] sm:max-h-[18rem] lg:max-h-[19rem]"
            page="[zoom:0.42] sm:[zoom:0.5]"
          >
            <PersonExhbt slug={e.slug} stage="draft" className="p-8" />
          </Frame>
        }
      />
    </main>
  );
}
