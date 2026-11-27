import "server-only";
import { firstExhbtLiveEmail } from "@/lib/email/templates/first-exhbt-live";
import { sendEmail } from "@/lib/email/send";
import type { Plan } from "@/lib/entitlements";
import { portfolioUrl } from "@/lib/hosts";
import { visibleOnPortfolio } from "@/lib/plan-rules";
import { getStore, type ExhbtRecord } from "@/lib/store";

/**
 * What follows a successful publish: the `exhbt_published` event and, for a person's first exhbt, one email.
 * The publish action hands this to `runInBackground`, only after the store said the publish worked, so neither
 * can fail or slow it. Every failure here is logged and goes no further.
 */
export async function afterPublish(opts: {
  userId: string;
  email: string;
  exhbtId: string;
  slug: string;
  username: string;
  plan: Plan;
  /** The person's exhbts as they were read before this publish. */
  before: ExhbtRecord[];
  /** The site's origin, read in the request (it comes from the request's headers). */
  origin: string;
}): Promise<void> {
  const { userId, email, exhbtId, slug, username, plan, before, origin } = opts;
  const store = getStore();
  // published_at stays when an exhbt is unpublished, so "never published" also means "not republished".
  const republish = Boolean(before.find((e) => e.id === exhbtId)?.publishedAt);
  const neverPublished = before.every((e) => !e.publishedAt);

  let after: ExhbtRecord[];
  try {
    after = await store.listExhbts(userId);
    // No words from the exhbt, no title and no file names. The exhbt does not record whether it began as a roadmap
    // idea (createFromIdea only prefills the doc), so there is no `from_idea`.
    await store.logEvent("exhbt_published", userId, { n: after.filter((e) => e.status === "published").length, republish });
  } catch (e) {
    console.error("publish event failed", (e as Error).message);
    return;
  }

  // One email, at the first publish ever, and only when the exhbt is on a page the public can open: a plan with no
  // public portfolio (Free) gets none. A second exhbt, a republish and an unpublish then publish again never get here.
  if (!neverPublished || !visibleOnPortfolio(plan, after).some((e) => e.id === exhbtId)) return;
  try {
    // The claim is the one gate: of any number of publishes at the same moment, the store lets one caller through.
    // It is kept if the send then fails: a missed email costs less than a second one.
    if (!(await store.claimEventOnce("first_publish_emailed", userId))) return;
    const content = firstExhbtLiveEmail({
      exhbtUrl: `https://${portfolioUrl(username, slug)}`,
      portfolioUrl: `https://${portfolioUrl(username)}`,
      privacyUrl: `${origin}/legal/privacy`,
      logoUrl: `${origin}/brand/exhbt-mark.png`,
    });
    await sendEmail({ to: email, ...content });
  } catch (e) {
    console.error("first publish email failed", (e as Error).message);
  }
}
