import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test } from "@playwright/test";
import { EXHBTS_PER_JOB_LINK, JOB_LINKS_LIVE, PLAN_NAMES } from "../lib/entitlements";
import { demoExhbts } from "../lib/exhbt";
import { LIMITS, validateForPublish, wordCount } from "../lib/exhbt/blocks";
import { portfolioHost, portfolioUrl } from "../lib/hosts";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";

/**
 * The home page as Rory asked for it (16 Nov 2026): one real exhbt with words beside it, how it
 * works as a flow, the address built round the real portfolio home and its looks, a link per job,
 * and the questions as disclosures. The demo portfolio behind it is in the new exhbt shape.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PIXEL_7 = (({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }) => ({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }))(devices["Pixel 7"]);

test.describe("Home: the demo data", () => {
  test("every demo exhbt keeps to the product's own limits, with the new fields", () => {
    expect(demoExhbts.map((e) => e.slug)).toEqual(["gp-reminders", "ae-forecast", "bed-dashboard", "study-habits"]);
    for (const { slug, doc } of demoExhbts) {
      expect(validateForPublish(doc), slug).toEqual([]);
      expect(wordCount(doc), slug).toBeLessThanOrEqual(LIMITS.totalWords);
      // The page layout (decision 0022): the title is the question, a highlighted gap, where and when, a summary.
      expect(doc.title.trim().endsWith("?"), slug).toBe(true);
      expect(doc.gap.some((r) => r.b), slug).toBe(true);
      expect(doc.whereWhen?.trim(), slug).toBeTruthy();
      expect(doc.summary?.trim(), slug).toBeTruthy();
    }
  });
});

test.describe("Home: sections", () => {
  test("the address section sells the address truthfully, with the real portfolio home", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby=address]");
    await expect(section.getByRole("heading", { level: 2, name: "A site that’s all yours" })).toBeVisible();
    await expect(section.getByText(portfolioHost("amara"), { exact: true }).first()).toBeVisible();
    // Paid only, named from PLAN_NAMES; never "your own domain" or a .com.
    await expect(section).toContainText(`Your own address comes with ${PLAN_NAMES.premium} and ${PLAN_NAMES.max}`);
    await expect(page.getByText(/your own domain|\.com\b/i)).toHaveCount(0);
    // The picture is the real portfolio home, hidden from screen readers and described instead.
    await expect(section.locator("[data-portfolio-home]")).toHaveCount(1);
    await expect(section.getByRole("figure", { name: /Amara Okafor's portfolio home page/ })).toBeAttached();
    // One h1 on the page: the portfolio's own heading is inside the picture.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("trying a look restyles the portfolio picture", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby=address]");
    const looks = section.getByRole("group", { name: "Try a look" }).getByRole("radio");
    await expect(looks.first()).toBeChecked();
    expect(await looks.count()).toBeGreaterThan(1);
    // Click a look's label (the radio itself is visually hidden inside it).
    const other = PORTFOLIO_THEMES[1]!;
    const radio = section.getByRole("radio", { name: other.name, exact: true });
    await radio.locator("xpath=ancestor::label").click();
    await expect(radio).toBeChecked();
    await expect(section.locator("[data-portfolio-home]")).toHaveAttribute("data-theme", other.id);
    // The arrow keys move along the group, like any radio group.
    await radio.focus();
    await page.keyboard.press("ArrowRight");
    await expect(section.locator("[data-portfolio-home]")).toHaveAttribute("data-theme", PORTFOLIO_THEMES[2]!.id);
  });

  test("how it works is a flow of four steps, ending on the person's own site", async ({ page }) => {
    await page.goto("/");
    const steps = page.getByRole("list", { name: "How an exhbt gets made" }).getByRole("listitem");
    await expect(steps).toHaveCount(4);
    await expect(steps.last()).toContainText("It goes live on your site");
    await expect(steps.last()).toContainText(`on ${PLAN_NAMES.premium} and ${PLAN_NAMES.max}`);
    // The old editor excerpt is gone.
    await expect(page.getByText("This is accurate and it is my own work.")).toHaveCount(0);
  });

  test("the per-job links section, with Coming soon only while the links are off", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby=job-links]");
    await expect(section.getByRole("heading", { level: 2, name: "A link for each job you apply for" })).toBeVisible();
    await expect(section).toContainText(portfolioUrl("amara", "lloyds"));
    await expect(section).toContainText(`picks up to ${EXHBTS_PER_JOB_LINK} of your exhbts`);
    await expect(section.getByText(/Amara Okafor and her applications are made up/)).toBeVisible();
    await expect(section).toContainText(`On ${PLAN_NAMES.max}.`);
    await expect(section.getByText("Coming soon", { exact: true })).toHaveCount(JOB_LINKS_LIVE ? 0 : 1);
  });

  test("questions are disclosures: closed at first, opened with the keyboard, and they pass axe", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("section[aria-labelledby=faq]");
    const first = faq.locator("details").first();
    await expect(faq.locator("details[open]")).toHaveCount(0);
    await expect(first.getByText(/Not to start/)).toBeHidden();

    // A summary is focusable and toggles with Enter, then Space.
    const summary = first.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("open", "");
    await expect(first.getByText(/Not to start/)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(first).not.toHaveAttribute("open", "");

    // Open them all (more than one may be open) and scan the section.
    for (const s of await faq.locator("summary").all()) await s.click();
    await expect(faq.locator("details[open]")).toHaveCount(await faq.locator("details").count());
    const { violations } = await new AxeBuilder({ page }).include("section[aria-labelledby=faq]").withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("Home: the start form", () => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`the button is centred in the field and never clipped at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      for (const id of ["#start-hero", "#start-close"]) {
        const pill = (await page.locator(`form:has(${id}) > div`).boundingBox())!;
        const button = page.locator(`form:has(${id}) button[type=submit]`);
        const b = (await button.boundingBox())!;
        // The field is as tall as the button, stacked or in a row (a flex-basis of 0 once collapsed it on phones).
        const field = (await page.locator(id).boundingBox())!;
        expect(field.height, `${id} field height`).toBeGreaterThanOrEqual(b.height - 1);
        expect(pill.x + pill.width, `${id} stays on screen`).toBeLessThanOrEqual(width);
        // Equal gaps above and below the button (1px for rounding), and on the right once it sits in a row.
        const top = b.y - pill.y;
        const bottom = pill.y + pill.height - (b.y + b.height);
        const right = pill.x + pill.width - (b.x + b.width);
        if (width >= 640) {
          expect(Math.abs(top - bottom), `${id} vertically centred`).toBeLessThanOrEqual(1);
          expect(Math.abs(right - top), `${id} same gap on the right`).toBeLessThanOrEqual(1);
        }
        // The label fits: its text isn't wider than the button.
        const fits = await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
        expect(fits, `${id} label fits`).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});

test.describe("Home: phone", () => {
  test.use(PIXEL_7);

  test("the new sections fit a Pixel 7 without sideways scroll", async ({ page }) => {
    await page.goto("/");
    for (const id of ["one-exhbt", "how", "address", "job-links", "faq"]) {
      await expect(page.locator(`section[aria-labelledby=${id}]`)).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
