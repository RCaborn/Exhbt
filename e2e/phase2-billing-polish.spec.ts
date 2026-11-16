import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { BILLING_PERIOD, ENTITLEMENTS, PLAN_NAMES, PRICES } from "../lib/entitlements";

// Billing polish: Stripe events out of order, the upgrade offer where a limit stops something,
// the pricing page selling for real with Phase 2 on, and files removed with their exhbt.

// Must match the webServer env in playwright.config.ts.
const SECRET = "whsec_test";
const PRICE_PREMIUM = "price_test_premium";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1e4)}`;

function subscriptionEvent(opts: { userId: string; subId: string; status: string; created: number }) {
  return JSON.stringify({
    id: `evt_${opts.subId}_${opts.created}_${opts.status}`,
    object: "event",
    type: "customer.subscription.updated",
    created: opts.created,
    data: {
      object: {
        id: opts.subId,
        object: "subscription",
        customer: `cus_${opts.subId}`,
        status: opts.status,
        metadata: { user_id: opts.userId, plan: "premium" },
        items: { object: "list", data: [{ id: "si_test", price: { id: PRICE_PREMIUM }, current_period_end: opts.created + 30 * 86_400 }] },
      },
    },
  });
}

async function postSigned(request: APIRequestContext, payload: string) {
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
}

/** A dev user with a username on a plan and no exhbts, signed in on /exhbts. */
async function signInAs(page: Page, username: string, plan: "free" | "premium") {
  await page.goto(`/dev/portfolio?username=${username}&plan=${plan}&count=0`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
}

/** Starts an empty exhbt from the list and returns its id, leaving the page in the editor. */
async function startFromScratch(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  await expect(page.locator("[data-ready=true]")).toBeAttached();
  return page.url().match(/\/exhbts\/([0-9a-f-]{36})\/edit$/)![1]!;
}

test.describe("Stripe events out of order", () => {
  test("an older event arriving after a newer one doesn't change the status", async ({ page, request }) => {
    const name = `order${stamp()}`;
    const userId = `dev-${name}@example.com`;
    const subId = `sub_${name}`;
    const now = Math.floor(Date.now() / 1000);

    // The newer event (active) arrives first, then an older one (incomplete) arrives late.
    expect((await postSigned(request, subscriptionEvent({ userId, subId, status: "active", created: now }))).status()).toBe(200);
    expect((await postSigned(request, subscriptionEvent({ userId, subId, status: "incomplete", created: now - 120 }))).status()).toBe(200);

    await page.goto(`/auth/dev?email=${name}@example.com&next=/account/billing`);
    await expect(page.getByRole("heading", { level: 1, name: "Billing" })).toBeVisible();
    await expect(page.getByTestId("current-plan")).toHaveText(PLAN_NAMES.premium);
    await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();

    // A newer event still applies.
    expect((await postSigned(request, subscriptionEvent({ userId, subId, status: "canceled", created: now + 60 }))).status()).toBe(200);
    await page.reload();
    await expect(page.getByTestId("current-plan")).toHaveText(PLAN_NAMES.free);
  });
});

test.describe("Upgrade at the point of need", () => {
  test("publishing on Free shows why, with the billing button", async ({ page }) => {
    await signInAs(page, `pubfree${stamp()}`.slice(0, 28), "free");
    await startFromScratch(page);
    const prompt = page.getByTestId("upgrade-prompt");
    await expect(prompt).toContainText(`Publishing to your own link comes with ${PLAN_NAMES.premium}.`);
    const upgrade = prompt.getByRole("link", { name: `Upgrade to ${PLAN_NAMES.premium} (${PRICES.premium} a ${BILLING_PERIOD})` });
    await expect(upgrade).toHaveAttribute("href", "/account/billing");
    await expect(prompt.getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/pricing");
    await upgrade.click();
    await expect(page.getByRole("heading", { level: 1, name: "Billing" })).toBeVisible();
  });

  test("with Premium full, a new exhbt is refused with the upgrade button", async ({ page }) => {
    await signInAs(page, `fullprem${stamp()}`.slice(0, 28), "premium");
    for (let i = 0; i < ENTITLEMENTS.premium.exhbts; i++) {
      await startFromScratch(page);
      await page.goto("/exhbts");
    }
    await expect(page.getByRole("button", { name: "Start from scratch" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Upload your project" })).toHaveCount(0);
    const prompt = page.getByTestId("upgrade-prompt");
    await expect(prompt).toContainText(`Your plan holds ${ENTITLEMENTS.premium.exhbts} exhbts.`);
    await expect(prompt.getByRole("link", { name: new RegExp(`^Upgrade to ${PLAN_NAMES.max}`) })).toHaveAttribute("href", "/account/billing");

    // The upload page refuses too, with the same offer.
    await page.goto("/exhbts/new");
    const alert = page.getByRole("alert").filter({ hasText: "Your plan holds" });
    await expect(alert.getByRole("link", { name: new RegExp(`^Upgrade to ${PLAN_NAMES.max}`) })).toHaveAttribute("href", "/account/billing");
    await expect(page.getByRole("button", { name: "Draft my exhbt" })).toHaveCount(0);
  });
});

test.describe("Pricing with Phase 2 on", () => {
  test("three plans with prices from entitlements, Choose buttons, and coming soon where not built", async ({ page }) => {
    await page.goto("/pricing");
    for (const tier of [PLAN_NAMES.free, PLAN_NAMES.premium, PLAN_NAMES.max]) {
      await expect(page.getByRole("heading", { level: 2, name: tier, exact: true })).toBeVisible();
    }
    for (const p of ["premium", "max"] as const) {
      const card = page.locator(`section#${p}`);
      await expect(card).toContainText(`${PRICES[p]}a ${BILLING_PERIOD}`);
      await expect(card.getByRole("link", { name: `Choose ${PLAN_NAMES[p]}` })).toHaveAttribute("href", "/account/billing");
      await expect(card.getByText("An originality check when you publish (coming soon)")).toBeVisible();
      await expect(card.getByText("Join the waitlist")).toHaveCount(0);
    }
    await expect(page.locator("section#max").getByText(/best fits \(coming soon\)$/)).toBeVisible();
    await expect(page.getByText("Coming soon", { exact: true })).toHaveCount(0);

    // Signed out, Choose goes through sign-in first.
    await page.locator("section#premium").getByRole("link", { name: `Choose ${PLAN_NAMES.premium}` }).click();
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)account(%2F|\/)billing/);
  });

  test("the home page plan cards sell the paid plans too", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Free to start" }) });
    for (const p of ["premium", "max"] as const) {
      await expect(section.getByRole("link", { name: `Choose ${PLAN_NAMES[p]}` })).toHaveAttribute("href", "/account/billing");
    }
    await expect(section.getByText("Join the waitlist")).toHaveCount(0);
  });

  test("no accessibility violations on /pricing", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "networkidle" });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("Clean-up", () => {
  test("deleting an exhbt deletes its uploaded image", async ({ page }) => {
    await signInAs(page, `clean${stamp()}`.slice(0, 28), "premium");
    const exhbtId = await startFromScratch(page);

    // A tiny PNG, uploaded for this exhbt through the Storage stand-in.
    const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
    const ticket = await page.request.post("/api/files/upload-url", {
      data: { name: "chart.png", mime: "image/png", bytes: png.length, kind: "image", exhbtId },
    });
    expect(ticket.status()).toBe(200);
    const { fileId, uploadUrl } = (await ticket.json()) as { fileId: string; uploadUrl: string };
    expect((await page.request.put(uploadUrl, { data: png, headers: { "content-type": "image/png" } })).status()).toBe(200);
    expect((await page.request.get(`/dev/files/${fileId}`)).status()).toBe(200);

    await page.goto("/exhbts");
    await page.getByRole("button", { name: "Delete Untitled exhbt" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.getByText("Nothing here yet.")).toBeVisible();
    expect((await page.request.get(`/dev/files/${fileId}`)).status()).toBe(404);
  });
});
