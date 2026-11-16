import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS, PLAN_NAMES } from "../lib/entitlements";
import { portfolioHost } from "../lib/hosts";
import { portfolioHref } from "../lib/portfolio-links";

// Portfolio settings (/account/portfolio): username claim with a live check, the profile, and
// what each plan says about publishing. The in-memory store starts empty for each run.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

async function signIn(page: Page, email: string) {
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=/account/portfolio`);
  await expect(page.getByRole("heading", { level: 1, name: "Portfolio settings" })).toBeVisible();
}

async function claim(page: Page, name: string) {
  await page.getByRole("textbox", { name: "Username" }).fill(name);
  await page.getByRole("button", { name: /(Claim|Change) username/ }).click();
}

const status = (page: Page) => page.locator("#username-status");

test.describe("Portfolio settings", () => {
  test("signed out, it asks you to sign in", async ({ page }) => {
    await page.goto("/account/portfolio");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fportfolio|\/login\?next=\/account\/portfolio/);
  });

  test("the account page links to portfolio settings and billing", async ({ page }) => {
    await page.goto(`/auth/dev?email=${unique("links")}@example.com&next=/account`);
    await expect(page.getByRole("link", { name: "Portfolio settings" })).toHaveAttribute("href", "/account/portfolio");
    await expect(page.getByRole("link", { name: "Billing" })).toHaveAttribute("href", "/account/billing");
  });

  test("claims a username, and refuses bad, reserved and taken ones with the reason", async ({ page }) => {
    const taken = unique("taken");
    const seeded = await page.request.get(`/dev/portfolio?username=${taken}&plan=premium&count=0`, { maxRedirects: 0 });
    expect(seeded.status()).toBe(307);

    await signIn(page, `${unique("claimer")}@example.com`);

    // The live check, as you type.
    await page.getByRole("textbox", { name: "Username" }).fill("Bad Name!");
    await expect(status(page)).toHaveText(/Use 3 to 30 lower-case letters/);
    await page.getByRole("textbox", { name: "Username" }).fill("admin");
    await expect(status(page)).toHaveText("That name is reserved. Try another.");
    await page.getByRole("textbox", { name: "Username" }).fill("two--hyphens");
    await expect(status(page)).toHaveText("Use single hyphens only.");
    await page.getByRole("textbox", { name: "Username" }).fill(taken);
    await expect(status(page)).toHaveText("That name is taken. Try another.");

    // The server refuses them too.
    for (const [name, reason] of [
      ["no", /Use 3 to 30 lower-case letters/],
      ["admin", /reserved/],
      ["two--hyphens", /single hyphens/],
      [taken, /taken/],
    ] as const) {
      await claim(page, name);
      await expect(status(page)).toHaveText(reason);
    }

    const mine = unique("mine");
    await page.getByRole("textbox", { name: "Username" }).fill(mine);
    await expect(status(page)).toHaveText("Available.");
    await page.getByRole("button", { name: "Claim username" }).click();
    await expect(page.getByText(portfolioHost(mine), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change username" })).toBeVisible();
    await expect(page.getByText("your old address redirects to the new one for 30 days")).toBeVisible();
    await expect(page.getByRole("link", { name: "View my portfolio" })).toHaveAttribute("href", portfolioHref(mine, "localhost"));
  });

  test("changes to the username are limited per hour", async ({ page }) => {
    await signIn(page, `${unique("limit")}@example.com`);
    const base = unique("lim");
    for (let i = 0; i < 5; i++) {
      await claim(page, `${base}-${i}`);
      await expect(page.getByText(portfolioHost(`${base}-${i}`), { exact: true })).toBeVisible();
    }
    await claim(page, `${base}-x`);
    await expect(status(page)).toHaveText(/Try again later/);
  });

  test("the profile saves, validates, and shows on the portfolio", async ({ page }) => {
    const name = unique("prof");
    await signIn(page, `${name}@example.com`);
    await claim(page, name);
    await expect(page.getByText(portfolioHost(name), { exact: true })).toBeVisible();

    // Seed exhbts for the same user (it overwrites the profile, so edit afterwards).
    const seeded = await page.request.get(`/dev/portfolio?username=${name}&plan=premium&count=2`, { maxRedirects: 0 });
    expect(seeded.status()).toBe(307);
    await page.goto("/account/portfolio");
    await expect(page.getByText(PLAN_NAMES.premium, { exact: true })).toBeVisible();
    await expect(page.getByText("Yes", { exact: true })).toBeVisible();

    // Too long, and a LinkedIn address that isn't a profile.
    await page.getByLabel(/Headline/).fill("one two three four five six seven eight nine ten eleven twelve thirteen");
    await page.getByLabel(/Bio/).fill(Array.from({ length: 41 }, (_, i) => `word${i}`).join(" "));
    await page.getByLabel(/LinkedIn/).fill("example.com/me");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("#profile-headline-error")).toHaveText(/12 words or fewer/);
    await expect(page.locator("#profile-bio-error")).toHaveText(/40 words or fewer/);
    await expect(page.locator("#profile-linkedin-error")).toHaveText(/linkedin\.com\/in\/your-name/);

    await page.getByLabel("Name", { exact: true }).fill("Sam Taylor");
    await page.getByLabel(/Headline/).fill("Junior analyst who likes tidy data");
    await page.getByLabel(/Bio/).fill("Maths graduate. I build small tools that save teams time.");
    await page.getByLabel(/LinkedIn/).fill("uk.linkedin.com/in/sam-taylor/");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status").getByText("Saved.")).toBeVisible();

    await page.goto(`/p/${name}`);
    await expect(page.getByRole("heading", { level: 1, name: "Sam Taylor" })).toBeVisible();
    await expect(page.getByText("Junior analyst who likes tidy data")).toBeVisible();
    await expect(page.getByText("Maths graduate. I build small tools that save teams time.")).toBeVisible();
    await expect(page.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/sam-taylor");
  });

  test("a free account is told its portfolio isn't public", async ({ page }) => {
    expect(ENTITLEMENTS.free.publicPortfolio).toBe(false);
    await signIn(page, `${unique("free")}@example.com`);
    await claim(page, unique("free"));
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
    await expect(page.getByText("No", { exact: true })).toBeVisible();
    await expect(page.getByText(`Your portfolio isn’t public on ${PLAN_NAMES.free}.`)).toBeVisible();
    await expect(page.getByRole("link", { name: PLAN_NAMES.premium })).toHaveAttribute("href", "/pricing");
  });

  test("the availability check needs a signed-in user", async ({ request }) => {
    const res = await request.get("/api/username/check?name=someone");
    expect(res.status()).toBe(401);
  });

  test("no accessibility violations on /account/portfolio", async ({ page }) => {
    await signIn(page, `${unique("a11y")}@example.com`);
    await claim(page, unique("a11y"));
    await expect(page.getByRole("button", { name: "Change username" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
