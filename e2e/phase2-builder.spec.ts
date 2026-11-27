import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { sampleDocs } from "../lib/exhbt/sample";
import { countWords, PROFILE_LIMITS, ProfileDraftSchema } from "../lib/portfolio-profile";

// The guided portfolio builder at /portfolio (decision 0016): four steps with a live preview and
// autosave, the "You" fields on the public page, "Suggest an intro" with the stand-in AI, the owner's
// preview of an unpublished page (visitors still get not found) and the tab title and icon.
// Portfolios are seeded with /dev/portfolio, plans set with the dev override.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const stamp = () => Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);
const GP = sampleDocs[0]!.title;
const LIBRARY = sampleDocs[1]!.title;

async function open(page: Page, username: string, plan = "max", count = 2, step = "you") {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}&count=${count}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=${encodeURIComponent(`/portfolio?step=${step}`)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
  await expect(page.locator("[data-ready=true]").first()).toBeAttached();
}

const status = (page: Page) => page.getByTestId("save-status");
async function saved(page: Page) {
  await expect(status(page)).not.toHaveText("Saved");
  await expect(status(page)).toHaveText("Saved");
}
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r.violations, JSON.stringify(r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);
}
const stepHeading = (page: Page) => page.getByRole("heading", { level: 2 }).first();
/** The home page's sections below the hero, top to bottom. */
const sections = (page: Page, scope = "[data-testid=preview]") =>
  page.locator(`${scope} [data-section]`).evaluateAll((els) => els.map((el) => el.getAttribute("data-section")));

test.describe("The profile rules, no browser", () => {
  test("links become https addresses, the intro keeps its paragraphs, limits are words", () => {
    const ok = ProfileDraftSchema.parse({
      name: "  Amara   Okafor ",
      headline: "Data analyst",
      bio: "First line.\n\n\n\nSecond   paragraph.",
      location: "Leeds",
      lookingFor: "Graduate data roles",
      linkedin: "linkedin.com/in/amara-o",
      github: "github.com/amara-o",
      website: "amara.dev",
      contactEmail: "Amara@Example.com",
      hideFromSearch: false,
    });
    expect(ok).toMatchObject({ name: "Amara Okafor", bio: "First line.\n\nSecond paragraph.", github: "https://github.com/amara-o", website: "https://amara.dev/", contactEmail: "amara@example.com" });
    const bad = (k: string, v: string) =>
      !ProfileDraftSchema.safeParse({ name: "", headline: "", bio: "", location: "", lookingFor: "", linkedin: "", github: "", website: "", contactEmail: "", hideFromSearch: false, [k]: v }).success;
    expect(bad("website", "http://amara.dev")).toBe(true);
    expect(bad("website", "javascript:alert(1)")).toBe(true);
    expect(bad("github", "gitlab.com/x")).toBe(true);
    expect(bad("contactEmail", "not an email")).toBe(true);
    expect(bad("bio", Array.from({ length: PROFILE_LIMITS.introWords + 1 }, () => "w").join(" "))).toBe(true);
    expect(bad("bio", Array.from({ length: PROFILE_LIMITS.introWords }, () => "w").join(" "))).toBe(false);
  });
});

test.describe("Build your portfolio", () => {
  test("the whole flow: you, your look, your projects, publish, then the public page", async ({ page }) => {
    const u = `bld${stamp()}`;
    await open(page, u);
    await expect(page.locator("nav[aria-label=Steps] a[aria-current=step]")).toHaveText(/You/);
    await expect(stepHeading(page)).toHaveText("About you");
    await axe(page);

    // You: every field shows in the preview as it is typed, then saves itself.
    await page.getByLabel("Name", { exact: true }).fill("Jordan Mensah");
    await page.getByLabel(/Headline/).fill("Graduate data analyst, transport and cities");
    await page.getByLabel(/Your intro/).fill("I studied Geography at Leeds and taught myself Python to map bus delays.\n\nI like work where a map changes a decision.");
    await page.getByLabel(/Where you’re based/).fill("Leeds");
    await page.getByLabel(/What you’re looking for/).fill("Graduate data roles from September");
    await page.getByLabel(/GitHub/).fill("github.com/jordan-m");
    await page.getByLabel(/^Email/).fill("Jordan@Example.com");
    const preview = page.getByTestId("preview");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Jordan Mensah");
    await expect(preview.locator("[data-intro] p")).toHaveCount(2);
    await expect(preview).toContainText("Looking for graduate data roles from September");
    await saved(page);

    // Your look.
    await page.getByRole("button", { name: "Continue to your look" }).click();
    await expect(page).toHaveURL(/step=look/);
    await expect(stepHeading(page)).toBeFocused();
    await page.locator('[data-theme-option="classic"]').click();
    await expect(preview.locator("[data-portfolio-home]")).toHaveAttribute("data-theme", "classic");
    await saved(page);
    await axe(page);

    // Your projects: keyboard reorder.
    await page.getByRole("button", { name: "Continue to your portfolio" }).click();
    await page.getByRole("button", { name: `Move ${GP}`, exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText(`Picked up ${GP}`);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText("is over position 2");
    await page.keyboard.press("Space");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText("Dropped");
    // Nothing starred, so the first exhbt is the band and the rest are cards.
    await expect(preview.locator("[data-section=featured] h2")).toHaveText(LIBRARY);
    await expect(preview.locator("[data-card] h3")).toHaveText([GP]);
    await saved(page);
    await axe(page);

    // Publish: the address and what's live.
    await page.getByRole("button", { name: "Continue to publish" }).click();
    await expect(stepHeading(page)).toHaveText("Publish and share");
    await expect(page.getByTestId("publish-checklist").locator("[data-done]")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
    await axe(page);

    // Back and forward in the browser move between steps.
    await page.goBack();
    await expect(stepHeading(page)).toHaveText("Your portfolio");

    // The public page: name first in the tab, the person's own icon, the intro, quiet contact lines.
    const res = await page.goto(`/p/${u}`);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle("Jordan Mensah · Graduate data analyst, transport and cities");
    const icon = await page.locator("link[rel=icon][href$='/initials.svg']").getAttribute("href");
    expect(icon).toBeTruthy();
    const svg = await page.request.get(icon!);
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
    expect(await svg.text()).toContain(">JM<");
    await expect(page.locator("[data-portfolio-home]")).toHaveAttribute("data-theme", "classic");
    await expect(page.locator("[data-intro]")).toContainText("taught myself Python");
    await expect(page.getByText("Based in Leeds")).toBeVisible();
    await expect(page.locator("[data-section=contact]").getByRole("link", { name: /github\.com\/jordan-m/ })).toHaveAttribute("href", "https://github.com/jordan-m");
    await expect(page.getByText("jordan@example.com")).toBeVisible();
    await expect(page.locator("a[href^='mailto:']")).toHaveCount(0);
    await expect(page.locator("[data-section=featured] h2")).toHaveText(LIBRARY);
    await expect(page.locator("[data-card] h3")).toHaveText([GP]);
    // Rory's layout: no catalogue numbers and no headline figures on the home page.
    await expect(page.locator("[data-catalogue], [data-headline]")).toHaveCount(0);
    await axe(page);
  });

  test("autosave survives a reload, and a field that fails isn't saved until it's fixed", async ({ page }) => {
    const u = `bls${stamp()}`;
    await open(page, u);
    await page.getByLabel(/Headline/).fill("Saved without a button");
    await saved(page);
    await page.getByLabel(/Website/).fill("http://not-https.example");
    await expect(page.locator("#you-website-error")).toContainText("https");
    await expect(status(page)).toContainText("Not saved yet");
    await page.reload();
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();
    await expect(page.getByLabel(/Headline/)).toHaveValue("Saved without a button");
    await expect(page.getByLabel(/Website/)).toHaveValue("");
  });

  test("Suggest an intro drafts one from the person's own facts, and Undo takes it back", async ({ page }) => {
    const u = `bli${stamp()}`;
    await open(page, u);
    const intro = page.getByLabel(/Your intro/);
    const before = await intro.inputValue();
    await page.getByLabel(/What you’re looking for/).fill("Graduate data roles in the NHS");
    await page.getByRole("button", { name: "Suggest an intro" }).click();
    await expect(page.getByText("written only from what you’ve told us")).toBeVisible();
    const suggested = await intro.inputValue();
    expect(suggested).not.toBe(before);
    expect(countWords(suggested)).toBeLessThanOrEqual(PROFILE_LIMITS.introWords);
    // The stand-in only uses what it was given: the exhbts' skills and the line typed above.
    expect(suggested).toContain("NHS");
    await saved(page);
    await page.getByRole("button", { name: "Undo: Suggested an intro" }).click();
    await expect(intro).toHaveValue(before);
  });

  test("the owner sees a preview of an unpublished page; everyone else gets not found", async ({ page, browser }) => {
    const u = `blo${stamp()}`;
    await open(page, u, "max", 0, "publish");
    await expect(page.getByTestId("publish-checklist")).toContainText("Publish an exhbt from the editor");
    const res = await page.goto(`/p/${u}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("owner-preview")).toContainText("Publish your first exhbt");
    await expect(page).toHaveTitle(/^Preview · /);
    await expect(page.locator("[data-section=featured][data-empty]")).toBeVisible();
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
    await axe(page);

    const visitor = await browser.newPage();
    expect((await visitor.goto(`/p/${u}`))?.status()).toBe(404);
    expect((await visitor.request.get(`/p/${u}/initials.svg`)).status()).toBe(404);
    await visitor.close();
  });

  test("sections drag with the mouse in the preview, with a lifted section while it moves; the home page follows", async ({ page }) => {
    // Tall enough for the whole preview to be on screen at once.
    await page.setViewportSize({ width: 1440, height: 2600 });
    const u = `bld${stamp()}`;
    await open(page, u, "max", 2, "projects");
    await page.getByRole("button", { name: "Edit About me" }).click();
    await page.locator("#about-text").fill("A line about me.");
    await saved(page);
    const preview = page.getByTestId("preview");
    expect(await sections(page)).toEqual(["featured", "work", "about", "contact"]);

    const grip = preview.getByRole("button", { name: "Move About me", exact: true });
    await grip.scrollIntoViewIfNeeded();
    const from = (await grip.boundingBox())!;
    const target = (await preview.locator("[data-section-key=featured]").boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y - 20, { steps: 4 });
    await page.mouse.move(from.x + 10, target.y + 20, { steps: 25 });
    await expect(page.getByTestId("lifted-section")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByTestId("lifted-section")).toHaveCount(0);
    await expect.poll(() => sections(page)).toEqual(["about", "featured", "work", "contact"]);
    await saved(page);
    await page.goto(`/p/${u}`);
    expect(await sections(page, "main")).toEqual(["about", "featured", "work", "contact"]);
  });

  test("the old addresses redirect into the builder", async ({ page }) => {
    await open(page, `blr${stamp()}`);
    await page.goto("/portfolio/customise");
    await expect(page).toHaveURL(/\/portfolio\?step=projects$/);
    await page.goto("/account/portfolio");
    await expect(page).toHaveURL(/\/portfolio\?step=you$/);
  });
});

test.describe("Build your portfolio on a phone", () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("no step and no portfolio page scrolls sideways, and the preview sits under the step", async ({ page }) => {
    const u = `blp${stamp()}`;
    await open(page, u);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    for (const step of ["you", "look", "projects", "publish"]) {
      await page.goto(`/portfolio?step=${step}`);
      await expect(page.locator("[data-ready=true]").first()).toBeAttached();
      expect(await overflow(), step).toBeLessThanOrEqual(0);
    }
    const panel = (await page.locator("section[aria-labelledby=step-heading]").boundingBox())!;
    const preview = (await page.getByTestId("preview").boundingBox())!;
    expect(preview.y).toBeGreaterThan(panel.y + panel.height - 1);
    await page.goto(`/p/${u}`);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await axe(page);
  });

  test("a press-and-hold on a section's grip drags it in the preview", async ({ page }) => {
    const u = `blt${stamp()}`;
    await open(page, u, "max", 2, "projects");
    expect(await sections(page)).toEqual(["featured", "work", "about", "contact"]);
    const preview = page.getByTestId("preview");
    const grip = preview.getByRole("button", { name: "Move Get in touch", exact: true });
    await grip.scrollIntoViewIfNeeded();
    const a = (await grip.boundingBox())!;
    const target = (await preview.locator("[data-section-key=about]").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const point = (x: number, y: number) => [{ x, y, id: 1 }];
    const sx = a.x + a.width / 2;
    const sy = a.y + a.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(sx, sy) });
    await page.waitForTimeout(300); // the short press that tells a drag from a scroll
    const ty = target.y + 10;
    for (let i = 1; i <= 20; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(sx, sy + ((ty - sy) * i) / 20) });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => sections(page)).toEqual(["featured", "work", "contact", "about"]);
    await saved(page);
  });
});
