"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Plan } from "@/lib/entitlements";
import { getCurrentUser, siteOrigin } from "@/lib/auth";
import { isPhase2Enabled } from "@/lib/site";
import { getStore, isSupabaseConfigured, LIVE_SUBSCRIPTION_STATUSES, setPlanForDevelopment } from "@/lib/store";
import { isPaidPlan, isStripeConfigured, priceForPlan, stripe, type PaidPlan } from "@/lib/stripe";

const PAGE = "/account/billing";

async function signedIn() {
  if (!isPhase2Enabled()) redirect("/account");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${PAGE}`);
  return user;
}

/** Sends the person to Stripe Checkout for a paid plan. The webhook records the result. */
export async function startCheckout(plan: PaidPlan) {
  const user = await signedIn();
  if (!isPaidPlan(plan) || !isStripeConfigured()) redirect(`${PAGE}?status=unavailable`);
  const price = priceForPlan(plan);
  if (!price) redirect(`${PAGE}?status=unavailable`);

  const store = getStore();
  const existing = await store.getSubscription(user.id);
  // Already paying: changes go through the portal, so nobody ends up with two subscriptions.
  if (existing && LIVE_SUBSCRIPTION_STATUSES.includes(existing.status)) redirect(`${PAGE}?status=already`);

  const origin = await siteOrigin();
  await store.logEvent("upgrade_clicked", user.id, { plan, from: "billing" });
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    // Reuse the Stripe customer from an earlier subscription, so their history stays in one place.
    ...(existing?.customerId ? { customer: existing.customerId } : { customer_email: user.email }),
    client_reference_id: user.id,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
    // A new-joiner discount can be a Stripe promotion code later, with no code change.
    allow_promotion_codes: true,
    success_url: `${origin}${PAGE}?status=success`,
    cancel_url: `${origin}${PAGE}?status=cancelled`,
  });
  if (!session.url) redirect(`${PAGE}?status=error`);
  redirect(session.url);
}

/**
 * Opens the Stripe Billing Portal (card, invoices, cancel). With `change`, it opens straight on
 * the plan-change screen, which is how someone moves between Premium and Max.
 */
export async function openPortal(change = false) {
  const user = await signedIn();
  if (!isStripeConfigured()) redirect(`${PAGE}?status=unavailable`);
  const sub = await getStore().getSubscription(user.id);
  if (!sub?.customerId) redirect(`${PAGE}?status=no-subscription`);
  const origin = await siteOrigin();
  const live = LIVE_SUBSCRIPTION_STATUSES.includes(sub.status);
  const session = await stripe().billingPortal.sessions.create({
    customer: sub.customerId,
    return_url: `${origin}${PAGE}`,
    ...(change && live
      ? { flow_data: { type: "subscription_update" as const, subscription_update: { subscription: sub.subscriptionId } } }
      : {}),
  });
  redirect(session.url);
}

/** Development only, with the in-memory store: set the plan without Stripe so the flow can be tried. */
export async function setDevelopmentPlan(plan: Plan) {
  const user = await signedIn();
  if (process.env.NODE_ENV === "production" || isSupabaseConfigured()) redirect(PAGE);
  if (plan !== "free" && plan !== "premium" && plan !== "max") redirect(PAGE);
  setPlanForDevelopment(user.id, plan);
  revalidatePath(PAGE);
  redirect(PAGE);
}
