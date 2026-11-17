import "server-only";
import { cookies } from "next/headers";
import { sign, verify } from "@/lib/access";
import { APEX, MARKETING_HOST } from "@/lib/hosts";
import { REFERRAL_CREDIT, REFERRAL_CREDIT_PENCE } from "@/lib/entitlements";
import { getStore, type ReferralRecord } from "@/lib/store";
import { stripe } from "@/lib/stripe";

/**
 * Referrals (decision 0020). Someone shares a link, /r/<code>; when the person they brought in
 * makes a first payment, the referrer gets REFERRAL_CREDIT as Stripe account credit.
 *
 * Built but OFF. Nothing here runs until REFERRALS_LIVE is true, which waits for Stripe being live
 * and for the cookie wording to be settled (decision 0020). Every entry point calls referralsLive().
 */
export const REFERRALS_LIVE = false;

export const referralsTestMode = () => process.env.NODE_ENV !== "production" && process.env.EXHBT_REFERRALS_TEST === "1";

/**
 * The one gate. Tests turn it on with EXHBT_REFERRALS_TEST=1, which also swaps the Stripe credit for
 * a recorded stand-in. Both are ignored in production.
 */
export function referralsLive(): boolean {
  return REFERRALS_LIVE || referralsTestMode();
}

export const REFERRAL_COOKIE = "exhbt_ref";
export const REFERRAL_COOKIE_DAYS = 30;
/** What a code looks like (profiles.referral_code check). */
export const REFERRAL_CODE_RE = /^[a-z0-9]{6,12}$/;

const isOurHost = (host: string | null | undefined) => {
  const h = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  return h === APEX || h.endsWith(`.${APEX}`);
};

/** The address a person shares. On our own domains it is always the marketing host. */
export function referralLink(code: string, host?: string | null, proto = "http"): string {
  if (!host || isOurHost(host)) return `https://${MARKETING_HOST}/r/${code}`;
  return `${proto}://${host}/r/${code}`;
}

/** Cookie settings. On our domains it is shared across www and app: the link lands on one, sign-in on the other. */
export function referralCookieOptions(host: string | null) {
  return {
    httpOnly: true,
    // Lax, because the sign-in link arrives as a navigation from an email.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * REFERRAL_COOKIE_DAYS,
    ...(isOurHost(host) ? { domain: `.${APEX}` } : {}),
  };
}

/** The cookie's value: the code and when the link was followed, signed so it can't be made up. */
export async function referralCookieValue(code: string, issuedAtMs = Date.now()): Promise<string> {
  return sign(`${code}|${issuedAtMs}`);
}

async function readCookie(): Promise<{ code: string; issuedAt: number } | null> {
  const payload = await verify((await cookies()).get(REFERRAL_COOKIE)?.value);
  if (!payload) return null;
  const [code, at] = payload.split("|");
  const issuedAt = Number(at);
  if (!REFERRAL_CODE_RE.test(code ?? "") || !Number.isFinite(issuedAt)) return null;
  return { code, issuedAt };
}

/** Development only (no Supabase): addresses that have signed in before, standing in for created_at. */
const dev = globalThis as unknown as { __exhbtDevSeen?: Set<string> };

/**
 * Called when someone signs in through a link (the three /auth routes). If the browser carries a
 * valid referral cookie, records the referral, once.
 *
 * Only a NEW account counts: it must have been created after the link was followed, so an existing
 * user who clicks a link is never "referred". Not themselves, not if they already have a referrer,
 * not if they already have a subscription. `createdAt` is the auth user's created_at; null in
 * development without Supabase, where the first sign-in of an address stands in for creation.
 */
export async function recordReferralFromCookie(userId: string, createdAt: string | null): Promise<void> {
  if (!referralsLive()) return;
  try {
    let created = createdAt ? Date.parse(createdAt) : NaN;
    if (!createdAt) {
      const seen = (dev.__exhbtDevSeen ??= new Set());
      created = seen.has(userId) ? 0 : Date.now();
      seen.add(userId);
    }
    const c = await readCookie();
    if (!c) return;
    // Created before the link was followed (a minute of slack for clocks): not a new account.
    if (!Number.isFinite(created) || created < c.issuedAt - 60_000) return;
    const store = getStore();
    const referrerId = await store.findUserByReferralCode(c.code);
    if (!referrerId || referrerId === userId) return;
    if (await store.getSubscription(userId)) return;
    if (await store.recordReferral(referrerId, userId)) await store.logEvent("referral_recorded", userId);
    (await cookies()).delete({ name: REFERRAL_COOKIE, path: "/" });
  } catch (e) {
    // Never block a sign-in over a referral.
    console.error(`[referrals] could not record: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

/** Stand-in credits recorded in development and tests (app/dev/referrals reads them). */
type Credit = { customerId: string; amount: number; referralId: string };
const stub = globalThis as unknown as { __exhbtReferralCredits?: Credit[] };
export const stubbedCredits = () => (stub.__exhbtReferralCredits ??= []);

/**
 * Credits the customer balance. A negative amount is a credit in Stripe. The idempotency key is
 * the referral's id, so a retry gets the same balance transaction back rather than a second credit.
 */
async function creditBalance(customerId: string, referralId: string): Promise<string> {
  if (referralsTestMode()) {
    const list = stubbedCredits();
    if (!list.some((c) => c.referralId === referralId)) list.push({ customerId, amount: -REFERRAL_CREDIT_PENCE, referralId });
    return `cbtxn_stub_${referralId}`;
  }
  const txn = await stripe().customers.createBalanceTransaction(
    customerId,
    {
      amount: -REFERRAL_CREDIT_PENCE,
      currency: "gbp",
      description: `Exhbt referral credit (${REFERRAL_CREDIT})`,
      metadata: { referral_id: referralId },
    },
    { idempotencyKey: `exhbt-referral-${referralId}` },
  );
  return txn.id;
}

/**
 * Called by the Stripe webhook when a person's subscription checkout completes.
 *
 * - If they were referred and this payment is real money (`paidNow`), their referral becomes
 *   earned. Only the first payment counts: a referral leaves pending once.
 * - Any earned referral whose referrer now has a Stripe customer is credited: this person's
 *   referrer, and referrals this person earned earlier while they had no customer yet.
 *
 * Safe to run again on a webhook retry: transitions are conditional and Stripe gets an
 * idempotency key. Throws if Stripe fails, so the webhook answers 500 and Stripe retries.
 */
export async function applyReferralsOnCheckout(userId: string, customerId: string | null, paidNow: boolean): Promise<void> {
  if (!referralsLive()) return;
  const store = getStore();
  const waiting: ReferralRecord[] = [];
  if (paidNow) {
    const earned = await store.markReferralEarned(userId);
    if (earned) waiting.push(earned);
  } else {
    const own = await store.getReferralByReferred(userId);
    if (own?.status === "earned") waiting.push(own);
  }
  for (const r of await store.listEarnedReferrals(userId)) if (!waiting.some((w) => w.id === r.id)) waiting.push(r);

  for (const r of waiting) {
    const referrerCustomer = r.referrerId === userId ? customerId : ((await store.getSubscription(r.referrerId))?.customerId ?? null);
    if (!referrerCustomer) continue; // stays earned until the referrer becomes a customer
    const ref = await creditBalance(referrerCustomer, r.id);
    if (await store.markReferralCredited(r.id, ref)) await store.logEvent("referral_credited", r.referrerId);
  }
}
