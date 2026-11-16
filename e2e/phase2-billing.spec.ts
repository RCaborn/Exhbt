import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { BILLING_PERIOD, PRICES } from "../lib/entitlements";

// Must match the webServer env in playwright.config.ts.
const SECRET = "whsec_test";
const PRICE_PREMIUM = "price_test_premium";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function signIn(page: Page, email: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=/account/billing`);
  await expect(page.getByRole("heading", { level: 1, name: "Billing" })).toBeVisible();
}

/** A hand-built subscription event, so the webhook needs no call to Stripe's API. */
function subscriptionEvent(type: string, userId: string, status: string) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    id: `evt_${type}_${now}`,
    object: "event",
    type,
    created: now,
    data: {
      object: {
        id: "sub_test_billing",
        object: "subscription",
        customer: "cus_test_billing",
        status,
        metadata: { user_id: userId, plan: "premium" },
        items: { object: "list", data: [{ id: "si_test", price: { id: PRICE_PREMIUM }, current_period_end: now + 30 * 86_400 }] },
      },
    },
  });
}

async function postSigned(request: APIRequestContext, payload: string) {
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
}

test.describe("Billing (Phase 2)", () => {
  test("the webhook rejects a bad signature", async ({ request }) => {
    const payload = subscriptionEvent("customer.subscription.updated", "dev-billing@example.com", "active");
    const wrong = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    const res = await request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": wrong } });
    expect(res.status()).toBe(400);
    const none = await request.post("/api/stripe/webhook", { data: payload });
    expect(none.status()).toBe(400);
  });

  test("a signed subscription event sets the plan, and a deletion returns it to Free", async ({ page, request }) => {
    const userId = "dev-billing@example.com";
    const updated = subscriptionEvent("customer.subscription.updated", userId, "active");
    expect((await postSigned(request, updated)).status()).toBe(200);
    // Repeats are harmless.
    expect((await postSigned(request, updated)).status()).toBe(200);
    // Events we don't use are accepted and ignored.
    const other = JSON.stringify({ id: "evt_other", object: "event", type: "invoice.paid", data: { object: {} } });
    expect((await postSigned(request, other)).status()).toBe(200);

    await signIn(page, "billing@example.com");
    await expect(page.getByTestId("current-plan")).toHaveText("Premium");
    await expect(page.getByText(/^Renews on /)).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();

    expect((await postSigned(request, subscriptionEvent("customer.subscription.deleted", userId, "canceled"))).status()).toBe(200);
    await page.reload();
    await expect(page.getByTestId("current-plan")).toHaveText("Free");
    await expect(page.getByRole("button", { name: "Choose Premium" })).toBeVisible();
  });

  test("on Free in development: both plans with prices, and the development plan row", async ({ page }) => {
    await signIn(page, "billing-dev@example.com");
    await expect(page.getByTestId("current-plan")).toHaveText("Free");
    await expect(page.getByRole("button", { name: "Choose Premium" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose Max" })).toBeVisible();
    for (const p of ["premium", "max"] as const) {
      await expect(page.getByText(`${PRICES[p]} a ${BILLING_PERIOD}`, { exact: true })).toBeVisible();
    }
    const dev = page.getByRole("group", { name: "Development: set plan" });
    await expect(dev).toBeVisible();
    await dev.getByRole("button", { name: "Premium", exact: true }).click();
    await expect(page.getByTestId("current-plan")).toHaveText("Premium");
  });

  test("no accessibility violations on /account/billing", async ({ page }) => {
    await signIn(page, "billing-a11y@example.com");
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
