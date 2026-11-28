import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS, PLAN_NAMES } from "../lib/entitlements";
import { portfolioHost } from "../lib/hosts";
import { canClaimUsername } from "../lib/plan-rules";
import { portfolioHref } from "../lib/portfolio-links";
import { PROFILE_LIMITS } from "../lib/portfolio-profile";
import { waitForStepBuilder } from "./helpers";

// The address and the profile, now in the portfolio builder (decision 0016): the username claim
// with a live check (paid plans only), the "You" fields with their limits, and what each plan says.
// Portfolio settings (/account/portfolio) redirects into the builder. The in-memory store starts
// empty for each run.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

/** Signs in as `email` on `plan` and opens a step of the builder. */
async function signIn(page: Page, email: string, plan = "premium", step = "publish") {
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=/exhbts`);
  await page.goto(`/dev/plan?plan=${plan}&next=${encodeURIComponent(`/portfolio?step=${step}`)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
  await waitForStepBuilder(page);
}

async function claim(page: Page, name: string) {
  await page.getByRole("textbox", { name: "Username" }).fill(name);
  await page.getByRole("button", { name: /(Claim|Change) username/ }).click();
}

const status = (page: Page) => page.locator("#username-status");
const saveStatus = (page: Page) => page.getByTestId("save-status");

test.describe("Address and profile", () => {
  test("signed out, it asks you to sign in; the old settings address goes to the builder", async ({ page }) => {
    await page.goto("/portfolio");
    await expect(page).toHaveURL(/\/login\?next=%2Fportfolio|\/login\?next=\/portfolio/);
    await page.goto(`/auth/dev?email=${unique("moved")}@example.com&next=/account/portfolio`);
    await expect(page).toHaveURL(/\/portfolio\?step=you$/);
  });

  test("the account page links to the builder and billing", async ({ page }) => {
    await page.goto(`/auth/dev?email=${unique("links")}@example.com&next=/account`);
    await expect(page.getByRole("link", { name: "Build your portfolio" })).toHaveAttribute("href", "/portfolio");
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
    await expect(page.getByRole("button", { name: "Change username" })).toBeVisible();
    await expect(page.getByText("your old address redirects to the new one for 30 days")).toBeVisible();
    await expect(page.getByRole("link", { name: portfolioHost(mine) })).toHaveAttribute("href", portfolioHref(mine, "localhost"));
  });

  test("changes to the username are limited per hour", async ({ page }) => {
    await signIn(page, `${unique("limit")}@example.com`);
    const base = unique("lim");
    for (let i = 0; i < 5; i++) {
      await claim(page, `${base}-${i}`);
      await expect(page.getByRole("link", { name: portfolioHost(`${base}-${i}`) })).toBeVisible();
    }
    await claim(page, `${base}-x`);
    await expect(status(page)).toHaveText(/Try again later/);
  });

  test("the profile saves itself, validates, and shows on the portfolio", async ({ page }) => {
    const name = unique("prof");
    const seeded = await page.request.get(`/dev/portfolio?username=${name}&plan=premium&count=2`, { maxRedirects: 0 });
    expect(seeded.status()).toBe(307);
    await signIn(page, `${name}@example.com`, "premium", "you");

    // Too long, and a LinkedIn address that isn't a profile: shown under the field, and nothing is saved.
    await page.getByLabel(/Headline/).fill("one two three four five six seven eight nine ten eleven twelve thirteen");
    await expect(page.locator("#you-headline-error")).toHaveText(/12 words or fewer/);
    await expect(saveStatus(page)).toContainText("Not saved yet");
    await page.getByLabel(/Headline/).fill("Junior analyst who likes tidy data");
    await page.getByLabel(/Your intro/).fill(Array.from({ length: PROFILE_LIMITS.introWords + 1 }, (_, i) => `word${i}`).join(" "));
    await expect(page.locator("#you-bio-error")).toHaveText(new RegExp(`${PROFILE_LIMITS.introWords} words or fewer`));
    await page.getByLabel(/Your intro/).fill("Maths graduate. I build small tools that save teams time.");
    await page.getByRole("textbox", { name: /LinkedIn/ }).fill("example.com/me");
    await expect(page.locator("#you-linkedin-error")).toHaveText(/linkedin\.com\/in\/your-name/);
    await expect(saveStatus(page)).toContainText("Not saved yet");

    await page.getByLabel("Name", { exact: true }).fill("Sam Taylor");
    await page.getByRole("textbox", { name: /LinkedIn/ }).fill("uk.linkedin.com/in/sam-taylor/");
    await expect(saveStatus(page)).toHaveText("Saved");

    await page.goto(`/p/${name}`);
    await expect(page.getByRole("heading", { level: 1, name: "Sam Taylor" })).toBeVisible();
    await expect(page.getByText("Junior analyst who likes tidy data")).toBeVisible();
    await expect(page.getByText("Maths graduate. I build small tools that save teams time.")).toBeVisible();
    await expect(page.getByRole("link", { name: /linkedin\.com\/in\/sam-taylor/ })).toHaveAttribute("href", "https://www.linkedin.com/in/sam-taylor");
  });

  test("a free account can't claim an address; one it already has stays", async ({ page }) => {
    expect(ENTITLEMENTS.free.publicPortfolio).toBe(false);
    expect(canClaimUsername("free")).toMatchObject({ ok: false, upgradeTo: "premium" });
    expect(canClaimUsername("premium").ok).toBe(true);

    await signIn(page, `${unique("free")}@example.com`, "free");
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveCount(0);
    await expect(page.getByTestId("upgrade-prompt").first()).toContainText(PLAN_NAMES.premium);
    // The live check refuses it as well.
    const check = await page.request.get(`/api/username/check?name=${unique("nope")}`);
    expect(await check.json()).toMatchObject({ ok: false });

    // Someone who claimed one on a paid plan keeps it after a downgrade, and can't change it.
    const kept = unique("kept");
    await page.goto("/dev/plan?plan=premium&next=%2Fportfolio%3Fstep%3Dpublish");
    await claim(page, kept);
    await expect(page.getByRole("button", { name: "Change username" })).toBeVisible();
    await page.goto("/dev/plan?plan=free&next=%2Fportfolio%3Fstep%3Dpublish");
    await expect(page.getByText(`Your address is ${portfolioHost(kept)}. It stays yours.`)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveCount(0);
  });

  test("the availability check needs a signed-in user", async ({ request }) => {
    const res = await request.get("/api/username/check?name=someone");
    expect(res.status()).toBe(401);
  });

  test("no accessibility violations on the address step", async ({ page }) => {
    await signIn(page, `${unique("a11y")}@example.com`);
    await claim(page, unique("a11y"));
    await expect(page.getByRole("button", { name: "Change username" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
