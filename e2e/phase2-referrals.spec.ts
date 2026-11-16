import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { BILLING_PERIOD, PRICES, REFERRAL_CREDIT, REFERRAL_CREDIT_PENCE } from "../lib/entitlements";

// Yearly prices, and referrals (decision 0020). Referrals are off in production; playwright.config.ts
// turns them on here with EXHBT_REFERRALS_TEST, which also records the Stripe credit instead of sending it.

const SECRET = "whsec_test"; // must match playwright.config.ts
const PRICE_PREMIUM = "price_test_premium";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

type Dev = {
  userId: string;
  code: string;
  asReferred: { status: string; referrerId: string; referredId: string | null; creditRef: string | null } | null;
  summary: { credited: number; waiting: number };
  credits: { customerId: string; amount: number; referralId: string }[];
};

/** Signs in (the dev stand-in for the magic link), then reads /dev/referrals as that person. */
async function signInAs(page: Page, email: string, next = "/dev/referrals"): Promise<void> {
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}
async function dev(page: Page): Promise<Dev> {
  const res = await page.request.get("/dev/referrals");
  expect(res.ok()).toBe(true);
  return (await res.json()) as Dev;
}
async function codeOf(page: Page, email: string): Promise<string> {
  await page.context().clearCookies();
  await signInAs(page, email);
  return (await dev(page)).code;
}
/** Follows someone's link, then signs in as a person who has not been here before. */
async function followAndSignIn(page: Page, code: string, email: string): Promise<Dev> {
  await page.context().clearCookies();
  await page.goto(`/r/${code}`);
  await expect(page).toHaveURL(/\/start$/);
  await signInAs(page, email);
  return dev(page);
}

const NOW = () => Math.floor(Date.now() / 1000);
/** A signed checkout.session.completed with the subscription expanded, so the webhook needs no call to Stripe. */
function checkoutEvent(opts: { id: string; userId: string; customer: string; sub: string; amount: number }) {
  const now = NOW();
  return JSON.stringify({
    id: opts.id,
    object: "event",
    type: "checkout.session.completed",
    created: now,
    data: {
      object: {
        id: `cs_${opts.id}`,
        object: "checkout.session",
        mode: "subscription",
        client_reference_id: opts.userId,
        payment_status: opts.amount > 0 ? "paid" : "no_payment_required",
        amount_total: opts.amount,
        subscription: {
          id: opts.sub,
          object: "subscription",
          customer: opts.customer,
          status: "active",
          metadata: { user_id: opts.userId, plan: "premium" },
          items: { object: "list", data: [{ id: "si_ref", price: { id: PRICE_PREMIUM }, current_period_end: now + 365 * 86_400 }] },
        },
      },
    },
  });
}
async function post(request: APIRequestContext, payload: string) {
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
}

test.describe("Yearly prices", () => {
  test("the pricing page, home page and terms say a year, never a month, for what you pay", async ({ page }) => {
    expect(BILLING_PERIOD).toBe("year");
    await page.goto("/pricing");
    for (const id of ["premium", "max"] as const) {
      await expect(page.locator(`#${id}`)).toContainText(`${PRICES[id]}a year`);
    }
    await expect(page.getByText(/a year, paid by card in one payment/)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/£\d+\s*(a|per|\/)\s*month/i);

    await page.goto("/");
    await expect(page.getByText("a year", { exact: true }).first()).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/£\d+\s*(a|per|\/)\s*month/i);

    await page.goto("/legal/terms");
    await expect(page.getByText(/are billed once a year, in one payment, through Stripe/)).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@exhbt.co.uk" })).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/billed each month/i);
  });

  test("signed in, the billing page prices each plan a year", async ({ page }) => {
    await page.goto(`/auth/dev?email=${unique("yearly")}@example.com&next=/account/billing`);
    for (const p of ["premium", "max"] as const) {
      await expect(page.getByText(`${PRICES[p]} a year`, { exact: true })).toBeVisible();
    }
  });
});

test.describe("Referrals (decision 0020)", () => {
  test("a referral link sets a 30-day httpOnly cookie, and signing up through it records one referral", async ({ page, context }) => {
    const referrer = `${unique("ref")}@example.com`;
    const code = await codeOf(page, referrer);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
    const asReferrer = await dev(page);
    expect(asReferrer.code).toBe(code); // asking again gives the same code

    await context.clearCookies();
    await page.goto(`/r/${code}`);
    await expect(page).toHaveURL(/\/start$/);
    const cookie = (await context.cookies()).find((c) => c.name === "exhbt_ref");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    const days = ((cookie?.expires ?? 0) - Date.now() / 1000) / 86_400;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
    // httpOnly: the page's own script can't read it.
    expect(await page.evaluate(() => document.cookie)).not.toContain("exhbt_ref");

    const referred = `${unique("newbie")}@example.com`;
    await signInAs(page, referred);
    const mine = await dev(page);
    expect(mine.asReferred).toMatchObject({ status: "pending", referrerId: asReferrer.userId });

    // Signing in again, even through another referrer's link, changes nothing: one referrer, ever.
    const otherCode = await codeOf(page, `${unique("other")}@example.com`);
    await context.clearCookies();
    await page.goto(`/r/${otherCode}`);
    await signInAs(page, referred);
    expect((await dev(page)).asReferred?.referrerId).toBe(asReferrer.userId);

    // The referrer sees a waiting referral, not who it is.
    await context.clearCookies();
    await signInAs(page, referrer);
    expect((await dev(page)).summary).toEqual({ credited: 0, waiting: 1 });
  });

  test("no self-referral, no referring someone who already had an account, an unknown code does nothing", async ({ page, context }) => {
    const referrer = `${unique("self")}@example.com`;
    const code = await codeOf(page, referrer);

    // Their own link, then signing in again as themselves.
    await context.clearCookies();
    await page.goto(`/r/${code}`);
    await signInAs(page, referrer);
    expect((await dev(page)).asReferred).toBeNull();

    // Someone who signed in before the link was followed is not a new account.
    const existing = `${unique("existing")}@example.com`;
    await context.clearCookies();
    await signInAs(page, existing);
    const before = await followAndSignIn(page, code, existing);
    expect(before.asReferred).toBeNull();

    // A code nobody has: home page, no cookie.
    await context.clearCookies();
    await page.goto("/r/abcdefgh");
    await expect(page).toHaveURL(/\/$/);
    expect((await context.cookies()).some((c) => c.name === "exhbt_ref")).toBe(false);
    // A malformed one too.
    await page.goto("/r/not%20a%20code!");
    await expect(page).toHaveURL(/\/$/);
    expect((await context.cookies()).some((c) => c.name === "exhbt_ref")).toBe(false);
  });

  test("a first payment credits the referrer once, however many times the event arrives, and later payments don't", async ({ page, request }) => {
    const referrer = `${unique("payee")}@example.com`;
    const referrerId = `dev-${referrer}`;
    const code = await codeOf(page, referrer);

    // The referrer is already a Stripe customer.
    const customer = unique("cus_ref");
    expect((await post(request, checkoutEvent({ id: unique("evt_r"), userId: referrerId, customer, sub: unique("sub_r"), amount: 900 }))).status()).toBe(200);

    const referred = `${unique("buyer")}@example.com`;
    const referredId = `dev-${referred}`;
    await followAndSignIn(page, code, referred);

    // A free first checkout (a 100% code) is not a payment.
    expect((await post(request, checkoutEvent({ id: unique("evt_f"), userId: referredId, customer: unique("cus_b"), sub: unique("sub_f"), amount: 0 }))).status()).toBe(200);
    expect((await dev(page)).asReferred?.status).toBe("pending");

    const paid = checkoutEvent({ id: unique("evt_p"), userId: referredId, customer: unique("cus_b"), sub: unique("sub_p"), amount: 900 });
    expect((await post(request, paid)).status()).toBe(200);
    // Stripe retries the same event; a second delivery must not pay twice.
    expect((await post(request, paid)).status()).toBe(200);
    // Another checkout later (another plan, another event) is not a first payment.
    expect((await post(request, checkoutEvent({ id: unique("evt_q"), userId: referredId, customer: unique("cus_b"), sub: unique("sub_q"), amount: 1500 }))).status()).toBe(200);

    const after = await dev(page);
    expect(after.asReferred?.status).toBe("credited");
    expect(after.asReferred?.creditRef).toMatch(/^cbtxn_/);
    const forThem = after.credits.filter((c) => c.customerId === customer);
    expect(forThem).toHaveLength(1);
    expect(forThem[0].amount).toBe(-REFERRAL_CREDIT_PENCE);

    // The referrer's account page shows the link, the copy button and the count.
    await page.context().clearCookies();
    await signInAs(page, referrer, "/account");
    await expect(page.getByRole("heading", { level: 2, name: "Refer a friend" })).toBeVisible();
    await expect(page.getByText(REFERRAL_CREDIT, { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId("referral-link")).toHaveText(new RegExp(`/r/${code}$`));
    await expect(page.getByRole("button", { name: "Copy referral link" })).toBeVisible();
    await expect(page.getByTestId("referral-count")).toHaveText("Credited so far: 1 friend.");
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("when the referrer isn't a Stripe customer yet, the credit waits and lands when they become one", async ({ page, request }) => {
    const referrer = `${unique("late")}@example.com`;
    const referrerId = `dev-${referrer}`;
    const code = await codeOf(page, referrer);
    const referred = `${unique("early")}@example.com`;
    await followAndSignIn(page, code, referred);

    expect((await post(request, checkoutEvent({ id: unique("evt_e"), userId: `dev-${referred}`, customer: unique("cus_e"), sub: unique("sub_e"), amount: 900 }))).status()).toBe(200);
    expect((await dev(page)).asReferred?.status).toBe("earned");

    const customer = unique("cus_late");
    expect((await post(request, checkoutEvent({ id: unique("evt_l"), userId: referrerId, customer, sub: unique("sub_l"), amount: 900 }))).status()).toBe(200);
    const after = await dev(page);
    expect(after.asReferred?.status).toBe("credited");
    expect(after.credits.filter((c) => c.customerId === customer)).toHaveLength(1);
  });

  test("the export has only your own side, and deleting the referred account keeps what the referrer earned", async ({ page, request }) => {
    const referrer = `${unique("exp")}@example.com`;
    const code = await codeOf(page, referrer);
    const referred = `${unique("gone")}@example.com`;
    const referredId = `dev-${referred}`;
    await followAndSignIn(page, code, referred);
    await post(request, checkoutEvent({ id: unique("evt_g"), userId: referredId, customer: unique("cus_g"), sub: unique("sub_g"), amount: 900 }));

    // The referred person's export says they were referred, not by whom.
    const own = (await (await page.request.get("/api/account/export")).json()) as { referralOnYourAccount: Record<string, unknown> | null };
    expect(own.referralOnYourAccount).toMatchObject({ status: "earned" });
    expect(JSON.stringify(own.referralOnYourAccount)).not.toContain(referrer);

    // They delete their account: the earned referral stays for the referrer, with the link to them cleared.
    const del = await page.request.post("/api/account/delete", { form: { confirm: "yes" }, maxRedirects: 0 });
    expect(del.status()).toBe(303);

    await page.context().clearCookies();
    await signInAs(page, referrer);
    expect((await dev(page)).summary.waiting).toBe(1);
    const mine = (await (await page.request.get("/api/account/export")).json()) as { referralsYouMade: { status: string; referred_id?: string }[] };
    expect(mine.referralsYouMade).toHaveLength(1);
    expect(mine.referralsYouMade[0].status).toBe("earned");
    expect(mine.referralsYouMade[0]).not.toHaveProperty("referred_id");
  });

  test("the cookie page and privacy page say referrals are not open yet", async ({ page }) => {
    await page.goto("/legal/cookies");
    await expect(page.getByRole("heading", { name: "Referral cookie (not in use yet)" })).toBeVisible();
    await expect(page.getByText(/we set no referral cookie today/)).toBeVisible();
    await page.goto("/legal/privacy");
    await expect(page.getByText(/Referrals are not open yet/)).toBeVisible();
  });
});
