import { expect, test, type Browser, type Page } from "@playwright/test";

/*
 * The frame round every app and marketing page (docs/briefs/appeal/2a-shell.md, step 2): the header drawn by
 * Astryx's TopNav, its phone menu Astryx's MobileNav. These are the six things Astryx's AppShell could have
 * broken, kept as tests on the frame as built:
 *   1. the document scrolls, and nothing in the frame is a scroll container;
 *   2. the site header scrolls away (decision 0031: only an editor's bar sticks);
 *   3. on an exhbt's edit page the editor's bar sits at the top of the window after a scroll;
 *   4. one skip link a keyboard can reach, which lands in the one main landmark;
 *   5. a phone gets the logo and the Menu button in the server's HTML, with no laptop row, and the header's box
 *      does not change as the page hydrates;
 *   6. marketing pages stay static: that one is the build's route table, not a browser test.
 */

const PHONE = { width: 390, height: 844 };

/** The header's box and what in it can be seen, read as soon as the page's HTML is in. */
async function headerNow(page: Page) {
  return page.evaluate(() => {
    const banner = document.querySelector("header")!;
    const b = banner.getBoundingClientRect();
    const seen = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const main = banner.querySelector('nav[aria-label="Main"]');
    const menu = [...banner.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Menu");
    const logo = banner.querySelector('a[aria-label="Exhbt home"]');
    return {
      box: [b.x, b.y, b.width, b.height].map((n) => Math.round(n)),
      row: main ? seen(main) : false,
      menu: menu ? seen(menu) : false,
      logo: logo ? seen(logo) : false,
    };
  });
}

async function signedIn(browser: Browser, username: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=1`);
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
  return { context, page };
}

const fresh = (tag: string) => `${tag}${Math.random().toString(36).slice(2, 8)}`;

test.describe("the frame", () => {
  test("the document scrolls, and nothing between the page and the window scrolls on its own", async ({ page }) => {
    await page.goto("/what-is-an-exhbt");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    const scrollers = await page.evaluate(() => {
      const found: string[] = [];
      for (let el = document.getElementById("main")?.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        const y = getComputedStyle(el).overflowY;
        if (y === "auto" || y === "scroll") found.push(el.tagName + (el.className ? `.${String(el.className).split(" ")[0]}` : ""));
      }
      return found;
    });
    expect(scrollers).toEqual([]);
  });

  test("the site header scrolls away with the page", async ({ page }) => {
    for (const path of ["/what-is-an-exhbt", "/pricing"]) {
      await page.goto(path);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await expect.poll(() => page.evaluate(() => window.scrollY), path).toBeGreaterThan(200);
      const bottom = await page.getByRole("banner").evaluate((el) => el.getBoundingClientRect().bottom);
      expect(bottom, path).toBeLessThanOrEqual(0);
    }
  });

  test("on an exhbt's edit page the editor's bar sticks to the top and the site header does not", async ({ browser }) => {
    const { context, page } = await signedIn(browser, fresh("shelled"));
    await page.locator('a[href$="/edit"]').first().click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    const bar = page.locator("[data-editor] [data-topbar]");
    await expect(bar).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    await expect.poll(() => bar.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
    expect(await page.getByRole("banner").evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    await context.close();
  });

  test("one skip link, reached first by Tab, lands in the one main landmark", async ({ page }) => {
    for (const path of ["/pricing", "/login"]) {
      await page.goto(path);
      await expect(page.getByRole("main"), path).toHaveCount(1);
      await expect(page.getByRole("link", { name: /skip to/i }), path).toHaveCount(1);
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to content" });
      await expect(skip, path).toBeFocused();
      await page.keyboard.press("Enter");
      const inMain = await page.evaluate(() => {
        const main = document.querySelector("main, [role=main]");
        return !!main && !!document.activeElement && main.contains(document.activeElement);
      });
      expect(inMain, path).toBe(true);
    }
  });
});

test.describe("the header on a phone, before and after scripts", () => {
  for (const who of ["signed out", "signed in"] as const) {
    test(`${who}: the server's HTML has the logo and the Menu button, and no laptop row`, async ({ browser }) => {
      const username = fresh("shellphone");
      let cookies: Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>> = [];
      if (who === "signed in") {
        const { context } = await signedIn(browser, username);
        cookies = await context.cookies();
        await context.close();
      }
      const path = who === "signed in" ? "/account" : "/pricing";
      const noScript = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
      await noScript.addCookies(cookies);
      const bare = await noScript.newPage();
      await bare.goto(path);
      const html = await headerNow(bare);
      expect(html).toMatchObject({ logo: true, menu: true, row: false });
      await noScript.close();

      const withScript = await browser.newContext({ viewport: PHONE });
      await withScript.addCookies(cookies);
      const page = await withScript.newPage();
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await headerNow(page)).toEqual(html);
      await withScript.close();
    });
  }

  test("at 1440 the row is in the server's HTML and the Menu button is not shown", async ({ browser }) => {
    const noScript = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const page = await noScript.newPage();
    await page.goto("/pricing");
    expect(await headerNow(page)).toMatchObject({ logo: true, menu: false, row: true });
    await noScript.close();
  });
});
