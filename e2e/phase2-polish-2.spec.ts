import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { uniqueEmail } from "./helpers";
import { draftAndOpen } from "./editor";

// Phase 2 polish, second pass: the phone header menu, one catalogue number, the per-card
// "More actions" menu, the flowchart as a row on wide screens and a column on phones, the exhbt
// list's headline and View link, and the profile photo for every plan.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const unique = (tag: string) => `${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

// Pixel 7 in the desktop project (a describe can't change the browser type, so leave that out).
const PIXEL_7 = (({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }) => ({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }))(devices["Pixel 7"]);

async function seed(page: Page, username: string, plan: string) {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
}

const signInAs = (page: Page, email: string, next: string) => page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const direction = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).flexDirection);

test.describe("Phone header", () => {
  test.use(PIXEL_7);

  test("Free: the header fits, and the links are one tap away in a menu that closes on Escape", async ({ page }) => {
    await signInAs(page, uniqueEmail("nav-free"), "/exhbts");
    await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);

    const header = page.locator("header").first();
    const menu = header.getByRole("button", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    // Nothing is clipped: the button and the logo sit inside the screen.
    const box = (await menu.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(header.getByRole("link", { name: "Account" })).toBeHidden();

    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const nav = header.getByRole("navigation", { name: "Main menu" });
    for (const name of ["Roadmaps", "Your exhbts", "Portfolio", "Account"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Job links" })).toHaveCount(0);
    // Focus moves into the panel.
    await expect(nav.getByRole("link").first()).toBeFocused();
    expect(await noSideScroll(page)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
    await expect(nav.getByRole("link", { name: "Account" })).toBeHidden();

    await menu.click();
    await nav.getByRole("link", { name: "Account" }).click();
    await page.waitForURL(/\/account$/);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  test("Max: Job links is in the menu, and a tap outside closes it", async ({ page }) => {
    const name = unique("navmax");
    await seed(page, name, "max");
    await signInAs(page, `${name}@example.com`, "/exhbts");
    await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    const header = page.locator("header").first();
    const menu = header.getByRole("button", { name: "Menu" });
    await menu.click();
    const nav = header.getByRole("navigation", { name: "Main menu" });
    for (const label of ["Roadmaps", "Your exhbts", "Job links", "Portfolio", "Account"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
    // A tap on the page below the panel (the gutter, so it hits no link).
    await page.mouse.click(4, page.viewportSize()!.height - 20);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  test("signed out: the marketing links are in the menu too, with no sideways scroll", async ({ page }) => {
    await page.goto("/pricing");
    expect(await noSideScroll(page)).toBe(true);
    const header = page.locator("header").first();
    await header.getByRole("button", { name: "Menu" }).click();
    await expect(header.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "What is an exhbt?" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Log in" })).toBeVisible();
  });
});

test.describe("Project page", () => {
  test("shows no catalogue number (decision 0022)", async ({ page }) => {
    const name = unique("cat");
    await seed(page, name, "premium");
    await page.goto(`/p/${name}/gp-reminders`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-catalogue]")).toHaveCount(0);
  });

  test("the flowchart is a row at 1440 wide", async ({ page }) => {
    const name = unique("flowrow");
    await seed(page, name, "premium");
    await page.goto(`/p/${name}/gp-reminders`);
    await expect(page.getByRole("list", { name: "Methodology" })).toBeVisible();
    expect(await direction(page, 'ol[aria-label="Methodology"]')).toBe("row");
  });
});

test.describe("Project page on a phone", () => {
  test.use(PIXEL_7);
  test("the flowchart is a column and nothing scrolls sideways", async ({ page }) => {
    const name = unique("flowcol");
    await seed(page, name, "premium");
    await page.goto(`/p/${name}/gp-reminders`);
    await expect(page.getByRole("list", { name: "Methodology" })).toBeVisible();
    expect(await direction(page, 'ol[aria-label="Methodology"]')).toBe("column");
    expect(await noSideScroll(page)).toBe(true);
  });
});

test.describe("Editor", () => {
  test("each card has one More actions menu: rewrite, back to the AI version, and the count", async ({ page }) => {
    await draftAndOpen(page, "menu", { waitForForm: false });
    const more = page.getByRole("button", { name: "More actions for Findings" });
    const tools = page.getByTestId("tools-findings");
    // No old two-button bar.
    await expect(page.getByRole("button", { name: "Rewrite the findings" })).toHaveCount(0);
    await expect(more).toHaveAttribute("aria-expanded", "false");

    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(tools.getByRole("button", { name: "Rewrite this block" })).toBeVisible();
    await expect(tools.getByTestId("rewrites-left")).toHaveText(/^\d+ of \d+ rewrites left$/);
    await expect(tools.getByRole("button", { name: "Back to the AI version" })).toHaveCount(0);

    await tools.getByRole("button", { name: "Rewrite this block" }).click();
    await page.getByRole("button", { name: "Rewrite the findings now" }).click();
    const findings = page.getByRole("textbox", { name: "Finding 1" });
    await expect(findings).toContainText("Preview rewrite 1");

    // Edit, then go back to the AI's wording.
    await findings.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" MY EDIT");
    await more.click();
    await tools.getByRole("button", { name: "Back to the AI version" }).click();
    await expect(findings).not.toContainText("MY EDIT");
    await expect(findings).toContainText("Preview rewrite 1");
  });

  test("the preview is wide enough for the flowchart to be a row at 1440, and the process card is a wrapping row", async ({ page }) => {
    await draftAndOpen(page, "row", { waitForForm: false });
    expect(await direction(page, 'section[aria-label="Preview"] ol[aria-label="Methodology"]')).toBe("row");
    expect(await direction(page, 'ol[aria-label="Process flowchart"]')).toBe("row");
    expect(await page.locator('ol[aria-label="Process flowchart"]').first().evaluate((el) => getComputedStyle(el).flexWrap)).toBe("wrap");
    expect(await noSideScroll(page)).toBe(true);
    // The boxes keep their move buttons, as left and right arrows.
    await expect(page.getByRole("button", { name: "Move box 1 later" })).toBeVisible();
  });

  test("no accessibility violations with a More actions menu open", async ({ page }) => {
    await draftAndOpen(page, "axe", { waitForForm: false });
    await page.getByRole("button", { name: "More actions for Process" }).click();
    await expect(page.getByTestId("tools-flow").getByRole("button", { name: "Rewrite this block" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("Editor on a phone", () => {
  test.use(PIXEL_7);
  test("the process card and the preview stay vertical", async ({ page }) => {
    await draftAndOpen(page, "phone", { waitForForm: false });
    expect(await direction(page, 'ol[aria-label="Process flowchart"]')).toBe("column");
    expect(await noSideScroll(page)).toBe(true);
    await page.getByRole("button", { name: "Preview" }).first().click();
    await expect(page.locator('section[aria-label="Preview"] ol[aria-label="Methodology"]')).toBeVisible();
    expect(await direction(page, 'section[aria-label="Preview"] ol[aria-label="Methodology"]')).toBe("column");
    expect(await noSideScroll(page)).toBe(true);
  });
});

test.describe("Your exhbts list", () => {
  test("shows each exhbt's headline number, and a View link for the live ones", async ({ page }) => {
    const name = unique("list");
    await seed(page, name, "premium");
    await signInAs(page, `${name}@example.com`, "/exhbts");
    await expect(page.getByRole("heading", { level: 1, name: "Your exhbts" })).toBeVisible();
    const rows = page.getByRole("list", { name: "Your exhbts, in portfolio order" }).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator("[data-headline]")).toContainText(/\d/);
    const view = rows.first().getByRole("link", { name: /^View / });
    await expect(view).toHaveAttribute("href", `/p/${name}/gp-reminders`);
    await view.click();
    await page.waitForURL(new RegExp(`/p/${name}/gp-reminders$`));
  });
});

test.describe("Profile photo on Free", () => {
  test("a Free user can upload, replace and remove a photo, and it shows on their preview", async ({ page }) => {
    await signInAs(page, uniqueEmail("freephoto"), "/portfolio?step=you");
    await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "About you" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload a photo" })).toBeVisible();

    const png = async () =>
      Buffer.from(
        await page.evaluate(() => {
          const c = document.createElement("canvas");
          c.width = 600;
          c.height = 400;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#4fe9b4";
          ctx.fillRect(0, 0, 600, 400);
          return c.toDataURL("image/png").split(",")[1]!;
        }),
        "base64",
      );
    const choose = async (name: string) => {
      await page.getByTestId("photo-input").setInputFiles({ name, mimeType: "image/png", buffer: await png() });
    };

    await choose("me.png");
    await expect(page.getByRole("status").filter({ hasText: "Photo saved." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    await expect(page.locator('[data-avatar="photo"]').first()).toBeVisible();

    // It shows beside the name in the editor's preview.
    await page.goto("/exhbts");
    await page.getByRole("button", { name: /start from scratch/i }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.locator('section[aria-label="Preview"] [data-avatar="photo"]')).toBeVisible();

    await page.goto("/portfolio?step=you");
    await choose("second.png");
    await expect(page.getByRole("status").filter({ hasText: "Photo saved." })).toBeVisible();
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Photo removed." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload a photo" })).toBeVisible();
  });
});

test.describe("Editor preview: the flowchart's words", () => {
  test("a six-box flowchart at 1440 breaks no word in the preview", async ({ page }) => {
    await draftAndOpen(page, "six", { waitForForm: false });
    const steps = ["Define bank and fintech strategies", "Set payoff matrix with openness parameter", "Derive replicator equations and rest points", "Classify stability of each equilibrium", "Select outcome via risk dominance", "Compare with the mandate's aims"];
    const add = page.getByRole("button", { name: "Add a box at the end" });
    while ((await page.getByLabel(/^Box \d$/).count()) < steps.length) await add.click();
    for (const [i, step] of steps.entries()) await page.getByLabel(`Box ${i + 1}`, { exact: true }).fill(step);
    const list = page.locator('section[aria-label="Preview"] ol[aria-label="Methodology"]');
    await expect(list.getByRole("listitem")).toHaveCount(6);
    const split = await list.evaluate((ol) => {
      const out: string[] = [];
      for (const label of ol.querySelectorAll("li > div > span:first-child")) {
        const node = label.firstChild;
        if (!node) continue;
        for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
          const r = document.createRange();
          r.setStart(node, m.index!);
          r.setEnd(node, m.index! + m[0].length);
          if (r.getClientRects().length !== 1) out.push(m[0]);
        }
      }
      return out;
    });
    expect(split).toEqual([]);
  });
});
