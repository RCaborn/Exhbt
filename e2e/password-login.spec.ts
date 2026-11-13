import { expect, test, type Page } from "@playwright/test";
import { portfolioHost } from "../lib/hosts";

const uniqueEmail = (tag: string) => `${tag}+${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;
const uniqueName = (tag: string) => `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`.slice(0, 24);

async function createAccount(page: Page, email: string, password: string, next = "/account") {
  await page.goto(`/login/new?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await page.waitForLoadState("load");
}

test("rejects a short or mismatched password, then signs in with the email", async ({ page }) => {
  const email = uniqueEmail("pw");
  const password = "correct-horse";
  await page.goto("/login/new?next=/account");
  await expect(page.getByRole("button", { name: "Email me a link" })).toHaveCount(0);

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill("different-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Those passwords don't match.")).toBeVisible();

  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.waitForLoadState("load");

  await page.context().clearCookies();
  await page.goto("/login?next=/account");
  await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Those details don't match.")).toBeVisible();

  await page.getByLabel("Email or username").fill("nosuchname");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Those details don't match.")).toBeVisible();

  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
});

test("a claimed username signs in, including the previous name while it redirects", async ({ page }) => {
  const email = uniqueEmail("un");
  const password = "username-password";
  const first = uniqueName("a");
  const second = uniqueName("b");
  await createAccount(page, email, password);

  await page.goto("/account/portfolio");
  await page.getByRole("textbox", { name: "Username" }).fill(first);
  await expect(page.locator("#username-status")).toHaveText("Available.");
  await page.getByRole("button", { name: "Claim username" }).click();
  await expect(page.getByText(portfolioHost(first), { exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "Username" }).fill(second);
  await expect(page.locator("#username-status")).toHaveText("Available.");
  await page.getByRole("button", { name: "Change username" }).click();
  await expect(page.getByText(portfolioHost(second), { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login?next=/account");
  await page.getByLabel("Email or username").fill(first);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login?next=/account");
  await page.getByLabel("Email or username").fill(second.toUpperCase());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
});

test("sets a new password from the one-time link, and the old one stops working", async ({ page }) => {
  const email = uniqueEmail("rs");
  const first = "first-password";
  const second = "second-password";
  await createAccount(page, email, first);
  await page.context().clearCookies();

  await page.goto("/login/reset");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText(/If an account uses that address/)).toBeVisible();
  await page.getByRole("link", { name: "Open the link" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Choose a password" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByLabel("New password").fill(second);
  await page.getByLabel("Confirm password").fill("not-the-same");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("Those passwords don't match.")).toBeVisible();

  await page.getByLabel("Confirm password").fill(second);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await page.waitForLoadState("load");

  await page.context().clearCookies();
  await page.goto("/login?next=/account");
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password").fill(first);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Those details don't match.")).toBeVisible();

  await page.getByLabel("Password").fill(second);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
});

test("a reset says the same thing whether or not the address has an account", async ({ page }) => {
  const email = `missing+${Date.now()}@example.com`;
  await page.goto("/login/reset");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText(/If an account uses that address/)).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
});
