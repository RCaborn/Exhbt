import { NextResponse, type NextRequest } from "next/server";
import { getStore, type SubscriptionRecord } from "@/lib/store";
import { isPaidPlan, planForPrice, stripe, verifyWebhook, type Stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe tells us about subscriptions here (docs/phase-2.md section 2). Set up in Stripe as
 * https://app.exhbt.co.uk/api/stripe/webhook with the three events below (LAUNCH.md).
 *
 * - Bad or missing signature: 400.
 * - Events we don't use: 200, ignored, so Stripe doesn't retry them.
 * - Repeats are harmless: rows are keyed on the Stripe subscription id.
 * Nothing about amounts or cards is stored or logged.
 */
export async function POST(req: NextRequest) {
  // The signature covers the exact bytes, so read the raw body before anything parses it.
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await verifyWebhook(body, req.headers.get("stripe-signature"));
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        // The session doesn't carry the subscription's period or price, so fetch it.
        const sub = await stripe().subscriptions.retrieve(id);
        await save(sub, session.client_reference_id);
        break;
      }
      case "customer.subscription.updated":
        await save(event.data.object, null);
        break;
      case "customer.subscription.deleted":
        await save(event.data.object, null, "canceled");
        break;
      default:
        break;
    }
  } catch (e) {
    // 500 makes Stripe retry later. The message has no card or amount details.
    console.error(`[stripe] ${event.type} failed: ${e instanceof Error ? e.message : "unknown error"}`);
    return NextResponse.json({ error: "Could not process the event" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

/** Writes a subscription to our table and logs the change. */
async function save(sub: Stripe.Subscription, clientReferenceId: string | null, forceStatus?: string) {
  // Checkout puts our user id on the session and on the subscription's metadata (billing/actions.ts).
  const userId = clientReferenceId || sub.metadata?.user_id;
  if (!userId) {
    console.warn(`[stripe] subscription without our user id, ignored`);
    return;
  }
  const item = sub.items?.data?.[0];
  const plan = planForPrice(item?.price?.id) ?? (isPaidPlan(sub.metadata?.plan) ? sub.metadata.plan : null);
  if (!plan) {
    console.warn(`[stripe] subscription for a price we don't sell, ignored`);
    return;
  }
  // Recent API versions keep the period on each item; older ones on the subscription.
  const periodEnd =
    item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
  const record: SubscriptionRecord = {
    userId,
    plan,
    status: forceStatus ?? sub.status,
    customerId: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    subscriptionId: sub.id,
    renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
  const store = getStore();
  await store.upsertSubscription(record);
  await store.logEvent("subscription_changed", userId, { plan: record.plan, status: record.status });
}
