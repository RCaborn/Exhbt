import { expect, test, type Page } from "./editor-test";
import type { ExhbtDoc } from "../lib/exhbt/blocks";
import { openBankingDoc } from "../lib/exhbt/sample";
import { fillTitle } from "./editor";
import { buildRoadmap, unlockProjects, waitForResult } from "./helpers";
import { freshName, openDoc, openNew, READY, readStored, waitReady, waitSaved } from "./page-editor";
import { READY as PORTFOLIO_READY, uiNow } from "./portfolio-editor";

/*
 * Portfolio first's structure (decision 0031, "The structure"; brief H): with the switch at "page" the app
 * hangs together round the portfolio, and at "steps" every page does what it did. Each case runs at both
 * settings, chosen for this browser with the development cookie (/dev/portfolio-kind?kind=), which stands in
 * for EXHBT_PORTFOLIO. The portfolio editor itself is other briefs' work: here /portfolio is only where things
 * land, so the cases check the address they land on, not what the portfolio draws there.
 *
 * Waiting for the upload page's chooser (phase-2-add-exhbt): the upload's words and its signed-out redirect.
 */

type Kind = "page" | "steps";
const KINDS: Kind[] = ["steps", "page"];

const unique = (tag: string) => `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

/** Sets the switch for this browser. */
async function kind(page: Page, k: Kind) {
  const res = await page.request.get(`/dev/portfolio-kind?kind=${k}`, { maxRedirects: 0 });
  expect(res.status()).toBeLessThan(400);
}

/** A dev user with a username on a plan, with `count` published sample exhbts, signed in at `next`. */
async function signInAs(page: Page, username: string, plan: "free" | "premium" | "max", next = "/account", count = 0) {
  expect((await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}&count=${count}`, { maxRedirects: 0 })).status()).toBe(307);
  await page.goto(`/auth/dev?email=${username}@example.com&next=${encodeURIComponent(next)}`);
}

/** Where a GET of `path` sends the browser, without following it: the status and the address. */
async function lands(page: Page, path: string): Promise<{ status: number; to: string | null }> {
  const res = await page.request.get(path, { maxRedirects: 0 });
  const to = res.headers()["location"] ?? null;
  return { status: res.status(), to: to ? to.replace(/^https?:\/\/[^/]+/, "") : null };
}

const complete = (extra: Partial<ExhbtDoc> = {}): ExhbtDoc => ({ ...openBankingDoc, ...extra }) as ExhbtDoc;
const bar = (page: Page) => page.locator("header[data-topbar]");
const sheet = (page: Page) => page.locator('dialog[data-sheet="publish"]');
const openPublish = async (page: Page) => {
  await page.getByRole("button", { name: "Review and publish" }).click();
  await expect(sheet(page)).toBeVisible();
};

test.describe("the exhbts list", () => {
  test("steps: the list as it is; page: a 307 to /portfolio with the query kept", async ({ page }) => {
    await kind(page, "steps");
    await signInAs(page, unique("lst"), "premium", "/exhbts");
    await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
    expect((await lands(page, "/exhbts?full=1")).status).toBe(200);

    await kind(page, "page");
    expect(await lands(page, "/exhbts")).toEqual({ status: 307, to: "/portfolio" });
    for (const q of ["full=1", "joined=1", "left=1"]) expect(await lands(page, `/exhbts?${q}`)).toEqual({ status: 307, to: `/portfolio?${q}` });
    // The hash of a sent email's link stays with the browser across the redirect. (From another page: a
    // change of hash alone on the list's own address would not load it again.)
    await page.goto("/account");
    // Caught as the page commits: the portfolio editor takes the hash out of the address once it acts on it.
    const landed = page.waitForURL(/\/portfolio#team-projects$/, { waitUntil: "commit" });
    await page.goto("/exhbts#team-projects", { waitUntil: "commit" });
    await landed;

    // Where the team actions send a person after joining (app/(app)/team/actions.ts): query and hash both come
    // through, and the portfolio editor opens Team with the note about joining.
    await page.goto("/account");
    const joined = page.waitForURL(/\/portfolio\?joined=1#team-projects$/, { waitUntil: "commit" });
    await page.goto("/exhbts?joined=1#team-projects", { waitUntil: "commit" });
    await joined;
    await expect(page.locator(PORTFOLIO_READY)).toBeAttached();
    await expect.poll(async () => (await uiNow(page)).sheet).toBe("team");
    expect((await uiNow(page)).team).toBe("joined");
  });
});

test.describe("Add an exhbt", () => {
  for (const k of KINDS) {
    test(`${k}: the chooser's heading, its way back, and where signing in comes back to`, async ({ page }) => {
      await kind(page, k);
      const at = k === "page";
      // Signed out: the plain chooser comes back to the portfolio at page; an address that says what is being
      // drafted, or into which exhbt, comes back to itself at both settings.
      expect(await lands(page, "/exhbts/new")).toEqual({ status: 307, to: at ? "/login?next=/portfolio" : `/login?next=${encodeURIComponent("/exhbts/new")}` });
      expect(await lands(page, "/exhbts/new?start=draft")).toEqual({ status: 307, to: `/login?next=${encodeURIComponent("/exhbts/new?start=draft")}` });
      const into = "00000000-0000-4000-8000-000000000000";
      expect(await lands(page, `/exhbts/new?into=${into}`)).toEqual({ status: 307, to: `/login?next=${encodeURIComponent(`/exhbts/new?into=${into}`)}` });

      await signInAs(page, unique(`ad${k[0]}`), "premium", "/exhbts/new");
      await expect(page.getByRole("heading", { level: 1, name: "Add an exhbt to your portfolio", exact: true })).toBeVisible();
      const back = page.locator("#main").getByRole("link", { name: at ? "Your portfolio" : "Your exhbts", exact: true });
      await expect(back).toHaveAttribute("href", at ? "/portfolio" : "/exhbts");
    });
  }
});

test.describe("the exhbt editor's way back", () => {
  test("steps: Your exhbts, to the list", async ({ page }) => {
    await kind(page, "steps");
    await openDoc(page, freshName("bks"), complete(), { plan: "premium" });
    await expect(bar(page).getByRole("link", { name: "Your exhbts" })).toHaveAttribute("href", "/exhbts");
  });

  test("page: Your portfolio, to the tile, and it waits for the last change to be saved", async ({ page }) => {
    await kind(page, "page");
    const { id } = await openDoc(page, freshName("bkp"), complete(), { plan: "premium" });
    const back = bar(page).getByRole("link", { name: "Your portfolio" });
    await expect(back).toHaveAttribute("href", `/portfolio?at=${id}`);
    await expect(bar(page).getByRole("link", { name: "Your exhbts" })).toHaveCount(0);
    // A title typed, then back at once: the portfolio is opened only once the title has been saved. Each save
    // is held for a second and a half here, so leaving before it lands would show.
    const title = `Open banking, rewritten ${Date.now().toString(36)}`;
    await page.route(`**/exhbts/${id}/edit`, async (route) => {
      if (route.request().method() === "POST") await new Promise((done) => setTimeout(done, 1500));
      await route.continue();
    });
    await fillTitle(page, title);
    await back.click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`/exhbts/${id}/edit$`));
    await page.waitForURL(new RegExp(`/portfolio\\?at=${id}$`), { waitUntil: "commit" });
    expect((await readStored(page, id)).working.title).toBe(title);
  });
});

test.describe("what follows a publish", () => {
  test("steps: the live panel, with Back to your exhbts", async ({ page }) => {
    await kind(page, "steps");
    const id = await openNew(page, freshName("pbs"));
    await page.evaluate((d) => window.__exhbtEditor!.patchDoc(() => d), complete() as never);
    await waitSaved(page, id);
    await openPublish(page);
    await sheet(page).getByLabel("This is my work, and the numbers are true").check();
    await sheet(page).getByRole("button", { name: "Publish", exact: true }).click();
    await expect(sheet(page).getByText("It's live on your portfolio.")).toBeVisible();
    await expect(sheet(page).getByRole("link", { name: "Back to your exhbts" })).toHaveAttribute("href", "/exhbts");
    await expect(page).toHaveURL(new RegExp(`/exhbts/${id}/edit$`));
  });

  test("page: a first publish lands on the portfolio at the tile; publishing changes stays, with Back to your portfolio", async ({ page }) => {
    await kind(page, "steps");
    const id = await openNew(page, freshName("pbp"));
    await page.evaluate((d) => window.__exhbtEditor!.patchDoc(() => d), complete() as never);
    await waitSaved(page, id);
    await kind(page, "page");
    await page.goto(`/exhbts/${id}/edit`);
    await waitReady(page);
    await openPublish(page);
    await sheet(page).getByLabel("This is my work, and the numbers are true").check();
    await sheet(page).getByRole("button", { name: "Publish", exact: true }).click();
    await page.waitForURL(new RegExp(`/portfolio\\?at=${id}$`), { waitUntil: "commit" });
    expect((await readStored(page, id)).published?.title).toBe(openBankingDoc.title);

    // Already live: publishing changes stays in the editor, with today's live panel.
    await page.goto(`/exhbts/${id}/edit`);
    await waitReady(page);
    await openPublish(page);
    await sheet(page).getByLabel("This is my work, and the numbers are true").check();
    await sheet(page).getByRole("button", { name: "Publish changes", exact: true }).click();
    await expect(sheet(page).getByText("Your changes are live on your portfolio.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/exhbts/${id}/edit$`));
    await expect(sheet(page).getByRole("link", { name: "Back to your portfolio" })).toHaveAttribute("href", `/portfolio?at=${id}`);
    await expect(sheet(page).getByRole("link", { name: "Back to your exhbts" })).toHaveCount(0);
  });

  for (const k of KINDS) {
    test(`${k}: Free's line in the publish sheet`, async ({ page }) => {
      await kind(page, k);
      const { id } = await openDoc(page, freshName(`fr${k}`), complete(), { plan: "free" });
      await openPublish(page);
      const s = sheet(page);
      await expect(s.getByRole("button", { name: /^Publish/ })).toHaveCount(0);
      if (k === "page") {
        await expect(s.getByText("This exhbt is on your portfolio as a draft only you can see.")).toBeVisible();
        await expect(s.getByRole("link", { name: "Back to your portfolio" })).toHaveAttribute("href", `/portfolio?at=${id}`);
        await expect(s.getByText("This exhbt is a preview only: nobody else can see it.")).toHaveCount(0);
      } else {
        await expect(s.getByText("This exhbt is a preview only: nobody else can see it.")).toBeVisible();
        await expect(s.getByRole("link", { name: "Back to your portfolio" })).toHaveCount(0);
      }
    });
  }
});

test.describe("redirects and back links", () => {
  for (const k of KINDS) {
    test(`${k}: the old addresses, the team page, the account and billing pages`, async ({ page }) => {
      test.slow(); // eight pages, each compiled on its first visit in the dev server
      await kind(page, k);
      const user = unique(`rd${k[0]}`);
      await signInAs(page, user, "premium", "/account");
      const at = k === "page";
      expect((await lands(page, "/account/portfolio")).to).toBe(at ? "/portfolio?open=address" : "/portfolio?step=you");
      expect((await lands(page, "/portfolio/customise")).to).toBe(at ? "/portfolio" : "/portfolio?step=projects");
      expect((await lands(page, "/job-links")).to).toBe(at ? "/portfolio?open=job-links" : "/portfolio#job-links");

      // The account page's links.
      await page.goto("/account");
      const nav = page.getByRole("navigation", { name: "Account settings" });
      await expect(nav.getByRole("link")).toHaveText(at ? ["Your portfolio", "Billing"] : ["Your exhbts", "Build your portfolio", "Billing"]);
      if (at) await expect(nav.getByRole("link", { name: "Your portfolio" })).toHaveAttribute("href", "/portfolio");

      // Billing, after a payment.
      await page.goto("/account/billing?status=success");
      await expect(page.getByRole("status").filter({ hasText: "Your payment went through" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to your portfolio" })).toHaveCount(at ? 1 : 0);
      if (at) await expect(page.getByRole("link", { name: "Back to your portfolio" })).toHaveAttribute("href", "/portfolio");
      await page.goto("/account/billing");
      await expect(page.getByRole("link", { name: "Back to your portfolio" })).toHaveCount(0);

      // The new job link page: its way back, and with nothing live, the link that says where to publish.
      await page.goto("/job-links/new");
      await expect(page.getByRole("link", { name: "Job links", exact: true })).toHaveAttribute("href", at ? "/portfolio?open=job-links" : "/portfolio#job-links");

      // The team page of an exhbt: back to that exhbt's editor at page.
      const { id } = await openDoc(page, user, complete(), { plan: "premium" });
      await page.goto(`/exhbts/${id}/team`);
      await expect(page.getByRole("heading", { level: 1, name: "Teammates" })).toBeVisible();
      if (at) {
        await expect(page.getByRole("link", { name: "Back to the exhbt" })).toHaveAttribute("href", `/exhbts/${id}/edit`);
      } else {
        await expect(page.getByRole("main").getByRole("link", { name: "Your exhbts" })).toHaveAttribute("href", "/exhbts");
      }
    });
  }

  test("page: a job link's own page links back to the Job links menu", async ({ page }) => {
    test.slow();
    await kind(page, "page");
    await signInAs(page, unique("jlb"), "max", "/job-links/new", 2);
    await expect(page.getByRole("heading", { level: 1, name: "New job link" })).toBeVisible();
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("Company", { exact: true }).fill("Acme");
    await page.getByLabel("Role title", { exact: true }).fill("Graduate Data Analyst");
    await page
      .getByLabel("Job description", { exact: true })
      .fill(
        "We are hiring a graduate data analyst for our customer insight team. You will write SQL against our sales data, " +
          "build time series forecasts of weekly demand, and keep the reporting in Excel up to date. Some Python is useful but " +
          "not essential. You will explain what you find to managers who are not analysts, so clear writing matters. The role " +
          "suits someone who checks their numbers and likes turning messy data into a plain answer. Training is provided.",
      );
    await page.getByRole("button", { name: "Pick my exhbts" }).click();
    await page.waitForURL(/\/job-links\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("link", { name: "Job links", exact: true })).toHaveAttribute("href", "/portfolio?open=job-links");
  });
});

test.describe("team invites", () => {
  test("page: joining lands on the portfolio, and the accepted invite links to the Team sheet", async ({ page }) => {
    test.slow();
    // Set up at steps, where the list gives the sample exhbt's id.
    await kind(page, "steps");
    const own = unique("tmo");
    const mate = `${unique("tmm")}@example.com`;
    await signInAs(page, own, "premium", "/exhbts", 1);
    const href = await page.locator('a[href$="/edit"]').first().getAttribute("href");
    const id = href!.match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
    await page.goto(`/exhbts/${id}/team`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("Their email address").fill(mate);
    await page.getByLabel(/What they did/).fill("Built the model");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.locator("#invite-result")).toHaveText(`Invite sent to ${mate}.`);
    await page.goto("/dev/emails");
    await page.getByRole("link", { name: new RegExp(`to ${mate.replace(/[+.]/g, "\\$&")}`) }).first().click();
    const accept = await page.frameLocator("iframe").getByRole("link", { name: "Accept the invite" }).getAttribute("href");
    const link = new URL(accept!).pathname + new URL(accept!).search;

    await kind(page, "page");
    await page.goto(`/auth/dev?email=${encodeURIComponent(mate)}&next=${encodeURIComponent(link)}`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("Your name, as it shows on the project").fill("Sam Teammate");
    await page.getByRole("button", { name: "Join the team" }).click();
    await page.waitForURL(/\/portfolio\?joined=1/, { waitUntil: "commit" });

    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: "You're on this project" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See your team projects" })).toHaveAttribute("href", "/portfolio?open=team");
    await kind(page, "steps");
    await page.goto(link);
    await expect(page.getByRole("link", { name: "Go to your exhbts" })).toHaveAttribute("href", "/exhbts#team-projects");
  });
});

test.describe("roadmap ideas", () => {
  test("steps and page: Add as an exhbt (the page's names it for the portfolio), the first lands on the portfolio and the next opens the editor", async ({ page }) => {
    test.slow();
    await kind(page, "steps");
    const email = `${unique("idea")}@example.com`;
    await buildRoadmap(page);
    await waitForResult(page);
    const roadmap = new URL(page.url()).pathname;
    await unlockProjects(page, { email });
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`${roadmap}?view=projects`)}`);
    await expect(page.getByRole("button", { name: /^Add as an exhbt/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Add to your portfolio as an exhbt/ })).toHaveCount(0);
    // Room for two.
    await page.goto(`/dev/plan?plan=premium&next=${encodeURIComponent(`${roadmap}?view=projects`)}`);

    await kind(page, "page");
    await page.goto(`${roadmap}?view=projects`);
    const add = page.getByRole("button", { name: /^Add to your portfolio as an exhbt/ });
    await expect(add.first()).toHaveText("Add as an exhbt");
    await expect(page.getByRole("button", { name: /^Add as an exhbt/ })).toHaveCount(0);
    await add.first().click();
    await page.waitForURL(/\/portfolio\?at=[0-9a-f-]{36}$/, { waitUntil: "commit" });

    await page.goto(`${roadmap}?view=projects`);
    await add.nth(1).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator(READY)).toBeAttached();
  });
});
