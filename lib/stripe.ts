import "server-only";
import Stripe from "stripe";

/**
 * Stripe, set up for the Workers runtime: HTTP through fetch and signatures through Web Crypto
 * (no Node sockets). Stripe is the source of the amount charged; PRICES in lib/entitlements.ts
 * is what the site shows, and the two prices in Stripe are set to match it (LAUNCH.md).
 *
 * Settings: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are Worker secrets. STRIPE_PRICE_PREMIUM
 * and STRIPE_PRICE_MAX are price ids (not secret), set in wrangler.jsonc vars.
 */

/** The plans sold through Stripe. Universities are licensed separately. */
export type PaidPlan = "premium" | "max";
export const PAID_PLANS: PaidPlan[] = ["premium", "max"];

/** Pinned to the stripe package's own default, so the types match what Stripe sends. */
export const STRIPE_API_VERSION = Stripe.API_VERSION;

export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: STRIPE_API_VERSION as Stripe.StripeConfig["apiVersion"],
  });
}

/**
 * Checks a webhook's signature and parses it. Needs only STRIPE_WEBHOOK_SECRET: verification
 * is local (Web Crypto), with no call to Stripe's API. Throws on a bad or missing signature.
 */
export async function verifyWebhook(body: string, signature: string | null): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  if (!signature) throw new Error("No Stripe-Signature header.");
  return Stripe.webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
}

const PRICE_ENV: Record<PaidPlan, string> = { premium: "STRIPE_PRICE_PREMIUM", max: "STRIPE_PRICE_MAX" };

/** The Stripe price id for a plan, or null when it isn't set. */
export function priceForPlan(plan: PaidPlan): string | null {
  return process.env[PRICE_ENV[plan]] || null;
}

/** The plan a Stripe price id stands for, or null for a price we don't sell. */
export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  return PAID_PLANS.find((p) => priceForPlan(p) === priceId) ?? null;
}

export const isPaidPlan = (p: unknown): p is PaidPlan => p === "premium" || p === "max";

export type { Stripe };
