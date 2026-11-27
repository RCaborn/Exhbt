import { expect, test, type Page } from "@playwright/test";
import { appNav } from "../components/site/app-nav";
import { landingAfterSignIn } from "../lib/landing";
import { buildRoadmap, unlockProjects, waitForResult } from "./helpers";

// Where someone lands after signing in, and the signed-in nav, under each setting of the portfolio switch
// (decision 0031, "The structure" and "The switch"; lib/portfolio-kind.ts). At "steps", which is what
// everyone gets until portfolio first is switched on, every sign-in lands where it always has. At "page"
// (here only by the development cookie, /dev/portfolio-kind) the three landings are /portfolio and the nav
// is "Your portfolio" and "Roadmaps". A `next` in the address wins both ways. The last tests are the
// in-memory store's roadmap prefill, which must do what the Supabase store does.

type Setting = "steps" | "page" | "default";
// /roadmap sends someone with no roadmap yet on to /roadmap/new, as it always has, so that counts as landing on it.
const SETTINGS: { setting: Setting; logIn: string; signUp: string; password: string; nav: string[] }[] = [
  { setting: "default", logIn: "/roadmap(?:/new)?", signUp: "/account", password: "/account", nav: ["Roadmaps", "Your exhbts", "Portfolio"] },
  { setting: "steps", logIn: "/roadmap(?:/new)?", signUp: "/account", password: "/account", nav: ["Roadmaps", "Your exhbts", "Portfolio"] },
  { setting: "page", logIn: "/portfolio", signUp: "/portfolio", password: "/portfolio", nav: ["Your portfolio", "Roadmaps"] },
];

const uniqueEmail = (tag: string) => `${tag}+${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;
const PASSWORD = "correct-horse";

/** Stands in for EXHBT_PORTFOLIO in this browser. It must be set again after the cookies are cleared. */
async function say(page: Page, setting: Setting) {
  expect((await page.request.get(`/dev/portfolio-kind?kind=${setting}`, { maxRedirects: 0 })).status()).toBe(307);
}

/**
 * page.goto, once more if it is aborted (ERR_ABORTED). Seen twice on /login/reset against `next dev`, once on a
 * first visit and once on a repeat; cause not found, so it is not explained here. Nothing about the app is retried.
 */
async function open(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (e) {
    if (!/ERR_ABORTED|interrupted by another navigation/.test(String(e))) throw e;
    await page.goto(url);
  }
}

const path = (page: Page) => new URL(page.url()).pathname;

/** The labels of the signed-in nav, as the header draws them on a desktop screen. */
const navLabels = (page: Page) => page.getByRole("navigation", { name: "Main" }).getByRole("link").allInnerTexts();

/** An account with a password, made with an explicit `next` so the setting under test is not involved. Leaves the browser signed in. */
async function makeAccount(page: Page, email: string) {
  await open(page, "/login/new?next=/account");
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.waitForLoadState("load");
}

async function logIn(page: Page, email: string, from = "/login") {
  await open(page, from);
  await expect(page.locator("form[data-ready=true]")).toBeAttached();
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe("the rules that decide, run directly", () => {
  test("landingAfterSignIn: today's places at steps or with Phase 2 off, /portfolio at page with Phase 2 on", () => {
    for (const phase2 of [true, false]) {
      expect(landingAfterSignIn("log-in", "steps", phase2)).toBe("/roadmap");
      expect(landingAfterSignIn("sign-up", "steps", phase2)).toBe("/account");
      expect(landingAfterSignIn("password", "steps", phase2)).toBe("/account");
    }
    // Phase 2 off, whatever the setting says: today's places, because there is no portfolio to land on.
    expect(landingAfterSignIn("log-in", "page", false)).toBe("/roadmap");
    expect(landingAfterSignIn("sign-up", "page", false)).toBe("/account");
    expect(landingAfterSignIn("password", "page", false)).toBe("/account");
    for (const how of ["log-in", "sign-up", "password"] as const) expect(landingAfterSignIn(how, "page", true)).toBe("/portfolio");
  });

  test("appNav: with Phase 2 off, Roadmaps only; steps is today's three; page is Your portfolio then Roadmaps", () => {
    for (const kind of ["steps", "page"] as const) expect(appNav(kind, false)).toEqual([{ href: "/roadmap", label: "Roadmaps" }]);
    expect(appNav("steps", true)).toEqual([
      { href: "/roadmap", label: "Roadmaps" },
      { href: "/exhbts", label: "Your exhbts" },
      { href: "/portfolio", label: "Portfolio" },
    ]);
    expect(appNav("page", true)).toEqual([
      { href: "/portfolio", label: "Your portfolio" },
      { href: "/roadmap", label: "Roadmaps" },
    ]);
  });
});

for (const { setting, logIn: logInTo, signUp, password, nav } of SETTINGS) {
  test.describe(`landings and nav with the portfolio switch at ${setting}`, () => {
    test("log in with a password lands where the setting says, and a next in the address wins", async ({ page }) => {
      const email = uniqueEmail("li");
      await makeAccount(page, email);

      await page.context().clearCookies();
      await say(page, setting);
      await logIn(page, email);
      await expect(page).toHaveURL(new RegExp(`${logInTo}$`));

      await page.context().clearCookies();
      await say(page, setting);
      await logIn(page, email, "/login?next=/exhbts");
      await expect(page).toHaveURL(/\/exhbts$/);
    });

    test("the email link lands where the setting says, and a next wins", async ({ page }) => {
      await say(page, setting);
      await open(page, "/login/link");
      await page.getByLabel("Email address").fill(uniqueEmail("ml"));
      await page.getByRole("button", { name: "Email me a link" }).click();
      await page.getByRole("link", { name: "Open the sign-in link" }).click();
      await expect(page).toHaveURL(new RegExp(`${logInTo}$`));

      await page.context().clearCookies();
      await say(page, setting);
      await open(page, "/login/link?next=/account");
      await page.getByLabel("Email address").fill(uniqueEmail("mn"));
      await page.getByRole("button", { name: "Email me a link" }).click();
      await page.getByRole("link", { name: "Open the sign-in link" }).click();
      await expect(page).toHaveURL(/\/account$/);
    });

    test("the development sign-in route lands where the setting says, and a next wins", async ({ page }) => {
      await say(page, setting);
      // Read the redirect itself: /roadmap goes on to /roadmap/new for someone with no roadmap, which would hide a wrong landing.
      const res = await page.request.get(`/auth/dev?email=${uniqueEmail("dr")}`, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(new URL(res.headers()["location"]!, "http://localhost").pathname).toBe(logInTo.replace("(?:/new)?", ""));
      await open(page, `/auth/dev?email=${uniqueEmail("dv")}`);
      await expect(page).toHaveURL(new RegExp(`${logInTo}$`));
      // A next no route sends on (at "page", /exhbts goes on to /portfolio), so the case tests that the next wins.
      await open(page, `/auth/dev?email=${uniqueEmail("dw")}&next=/account`);
      await expect(page).toHaveURL(/\/account$/);
    });

    test("sign-up lands where the setting says, and a next wins", async ({ page }) => {
      await say(page, setting);
      await open(page, "/login/new");
      await expect(page.locator("form[data-ready=true]")).toBeAttached();
      await page.getByLabel("Email address").fill(uniqueEmail("su"));
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm password").fill(PASSWORD);
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(new RegExp(`${signUp}$`));
      await page.waitForLoadState("load");

      await page.context().clearCookies();
      await say(page, setting);
      await open(page, "/login/new?next=/exhbts");
      await expect(page.locator("form[data-ready=true]")).toBeAttached();
      await page.getByLabel("Email address").fill(uniqueEmail("sv"));
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Confirm password").fill(PASSWORD);
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/\/exhbts$/);
    });

    test("setting a new password from the one-time link lands where the setting says", async ({ page }) => {
      const email = uniqueEmail("pw");
      await makeAccount(page, email);
      await page.context().clearCookies();
      await say(page, setting);

      await open(page, "/login/reset");
      await page.getByLabel("Email address").fill(email);
      await page.getByRole("button", { name: "Email me a link" }).click();
      await page.getByRole("link", { name: "Open the link" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Choose a password" })).toBeVisible();
      await expect(page.locator("form[data-ready=true]")).toBeAttached();
      await page.getByLabel("New password").fill("second-password");
      await page.getByLabel("Confirm password").fill("second-password");
      await page.getByRole("button", { name: "Save password" }).click();
      await expect(page).toHaveURL(new RegExp(`${password}$`));
    });

    test("the signed-in nav is the one for the setting", async ({ page }) => {
      await say(page, setting);
      await open(page, `/auth/dev?email=${uniqueEmail("nv")}&next=/account`);
      expect(path(page)).toBe("/account");
      expect(await navLabels(page)).toEqual(nav);
      // Every item goes where its label says.
      const hrefs = await page.getByRole("navigation", { name: "Main" }).getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(hrefs).toEqual(setting === "page" ? ["/portfolio", "/roadmap"] : ["/roadmap", "/exhbts", "/portfolio"]);
    });
  });
}

test.describe("the in-memory store fills an empty profile from the gate, as Supabase does", () => {
  /** Builds a roadmap as a visitor and answers the gate with these details, which are stored against the email. */
  async function answerGate(page: Page, email: string, name: string, linkedin: string) {
    await buildRoadmap(page, { withCv: true });
    await waitForResult(page);
    await unlockProjects(page, { email, name, linkedin });
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
  }

  const nameField = (page: Page) => page.getByLabel("Name", { exact: true });
  const linkedinField = (page: Page) => page.getByRole("textbox", { name: /LinkedIn/ });
  const YOU = `/portfolio?step=you`;

  test("a gate name and LinkedIn fill an empty profile at sign-in", async ({ page }) => {
    const email = uniqueEmail("gate");
    await answerGate(page, email, "Gate Person", "linkedin.com/in/gate-person");
    await open(page, `/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(YOU)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();
    await expect(nameField(page)).toHaveValue("Gate Person");
    await expect(linkedinField(page)).toHaveValue(/linkedin\.com\/in\/gate-person/);
  });

  test("a name already on the profile is not overwritten, and the empty LinkedIn is still filled", async ({ page }) => {
    const email = uniqueEmail("keep");
    // An account with a profile name of its own, before any gate answer exists.
    await open(page, `/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(YOU)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();
    await nameField(page).fill("Sam Taylor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved");

    // A visitor with the same address answers the gate with another name, then signs in again.
    await page.context().clearCookies();
    await answerGate(page, email, "Gate Person", "linkedin.com/in/gate-person");
    await open(page, `/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(YOU)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();
    await expect(nameField(page)).toHaveValue("Sam Taylor");
    await expect(linkedinField(page)).toHaveValue(/linkedin\.com\/in\/gate-person/);
  });
});
