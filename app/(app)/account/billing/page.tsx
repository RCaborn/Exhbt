import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FeatureList } from "@/components/site/FeatureList";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { BILLING_PERIOD, PLAN_NAMES, PRICES, planFeatures, type Plan } from "@/lib/entitlements";
import { getPlan } from "@/lib/plan";
import { isPhase2Enabled } from "@/lib/site";
import { getStore, isSupabaseConfigured, LIVE_SUBSCRIPTION_STATUSES } from "@/lib/store";
import { isStripeConfigured, PAID_PLANS, type PaidPlan } from "@/lib/stripe";
import { openPortal, setDevelopmentPlan, startCheckout } from "./actions";

export const metadata: Metadata = { title: "Billing", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Messages after a return from Stripe or a refused action (?status=…). */
const STATUS: Record<string, string> = {
  success: "Thanks. Your payment went through. Your plan changes here once Stripe confirms it, usually within a minute.",
  cancelled: "Checkout was cancelled. Nothing was charged.",
  already: "You already have a subscription. Use Manage billing to change it.",
  unavailable: "Payments aren't open yet.",
  "no-subscription": "There's no subscription on this account to manage.",
  error: "Something went wrong with Stripe. Nothing was charged. Please try again.",
};

const DEV_PLANS: Plan[] = ["free", "premium", "max"];

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!isPhase2Enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/billing");

  const [plan, sub, { status }] = await Promise.all([getPlan(user.id), getStore().getSubscription(user.id), searchParams]);
  const live = sub && LIVE_SUBSCRIPTION_STATUSES.includes(sub.status) ? sub : null;
  const paidByStripe = Boolean(live) && (plan === "premium" || plan === "max");
  const stripeOn = isStripeConfigured();
  const devTools = process.env.NODE_ENV !== "production" && !isSupabaseConfigured();
  const message = status ? STATUS[status] : undefined;
  const other: PaidPlan = plan === "max" ? "premium" : "max";

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-24 sm:px-8 lg:pt-16">
      <p>
        <Link href="/account" className="link text-sm">Account</Link>
      </p>
      <h1 className="mt-2">Billing</h1>

      {message && (
        <p role="status" className="mt-6 rounded-[14px] border border-line bg-wash px-4 py-3">
          {message}
        </p>
      )}

      <section aria-labelledby="current" className="mt-10">
        <h2 id="current" className="text-[1.375rem]">
          Your plan: <span data-testid="current-plan">{PLAN_NAMES[plan]}</span>
        </h2>
        <FeatureList items={planFeatures(plan === "institutional" ? "max" : plan)} className="mt-4" />
        {plan === "institutional" && <p className="mt-4 text-graphite">Your university&rsquo;s licence covers this. There&rsquo;s nothing to pay.</p>}
        {live?.renewsAt && (
          <p className="mt-4 text-graphite">
            {live.status === "past_due"
              ? "Your last payment didn't go through. Stripe will try again; you can update your card in Manage billing."
              : `Renews on ${dateFormat.format(new Date(live.renewsAt))}.`}
          </p>
        )}
      </section>

      {plan !== "institutional" && (
        <section aria-labelledby="change" className="mt-12 border-t border-line pt-8">
          <h2 id="change" className="text-[1.375rem]">{paidByStripe ? "Change or cancel" : plan === "free" ? "Upgrade" : "Change plan"}</h2>
          {!stripeOn ? (
            <p className="mt-3">
              Payments aren&rsquo;t open yet. See what each plan includes on the <Link href="/pricing" className="link">pricing page</Link>.
            </p>
          ) : paidByStripe ? (
            <>
              <p className="mt-3">Change your card, see invoices or cancel in Stripe&rsquo;s billing page.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={openPortal.bind(null, false)}>
                  <Button type="submit" variant="primary">Manage billing</Button>
                </form>
                <form action={openPortal.bind(null, true)}>
                  <Button type="submit">{`Switch to ${PLAN_NAMES[other]} (${PRICES[other]} a ${BILLING_PERIOD})`}</Button>
                </form>
              </div>
            </>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {PAID_PLANS.map((p) => (
                <li key={p} className="flex flex-col rounded-[16px] border border-line bg-surface p-5">
                  <h3>{PLAN_NAMES[p]}</h3>
                  <p className="mt-1 text-graphite">
                    <span className="font-mono text-ink">{PRICES[p]}</span> a {BILLING_PERIOD}
                  </p>
                  <FeatureList items={planFeatures(p)} className="mt-3 text-sm" />
                  <form action={startCheckout.bind(null, p)} className="mt-auto pt-5">
                    <Button type="submit" variant={p === "premium" ? "primary" : "secondary"}>{`Choose ${PLAN_NAMES[p]}`}</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-sm text-graphite">
            If you move to a smaller plan, nothing is deleted. Your portfolio shows your first exhbts in the order you
            set, up to the new plan&rsquo;s limit, and the rest stay in your account to publish again if you upgrade.
          </p>
        </section>
      )}

      {devTools && (
        <section aria-labelledby="dev-plan" className="mt-12 rounded-[16px] border border-dashed border-field p-5">
          <h2 id="dev-plan" className="text-base font-semibold">Development: set plan</h2>
          <p className="mt-1 text-sm text-graphite">Only on a local server without Supabase. It changes the plan straight away, with no payment.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="dev-plan">
            {DEV_PLANS.map((p) => (
              <form key={p} action={setDevelopmentPlan.bind(null, p)}>
                <Button type="submit" size="sm">{PLAN_NAMES[p]}</Button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
