import type { Page } from "@playwright/test";
import { FULL, fullFixture } from "./fixtures/portfolio-pages";
import { READY, call, expect, field, focusedPath, fresh, openEditor, setKind, stateNow, test, valueAt, waitReady, waitSaved } from "./portfolio-editor";

// The portfolio editor's bar and everything it opens (brief G of docs/briefs/portfolio-first; decision
// 0031, "The bar" and "What is edited where"): the chip, Look, See as a visitor, Job links, the menu and
// the primary button; the Look menu; the photo sheet; Suggest an intro and Your links; the address sheet;
// Team; and the first-run strip. Each test is a person of its own: a seeded portfolio (/dev/portfolio-parity),
// or a brand-new person signed in with a fresh email, put on a plan with /dev/plan.

const BAR = `${READY} [data-bar]`;
const bar = (page: Page) => page.locator(BAR);
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Your portfolio" });

/** A brand-new person: no address, no exhbts, on `plan`, in the editor. */
async function newPerson(page: Page, tag: string, plan: "free" | "premium" | "max" = "free") {
  await setKind(page, "page");
  const email = `pe-new-${tag}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const next = plan === "free" ? "/portfolio" : `/dev/plan?plan=${plan}&next=${encodeURIComponent("/portfolio")}`;
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  await waitReady(page);
}

test.describe("The bar", () => {
  test("at 1440 the row holds every part, and the chip says the page is live", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page, fresh(FULL, "bar-wide"));
    await expect(bar(page).getByRole("heading", { level: 1, name: "Your portfolio" })).toBeVisible();
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "live");
    await expect(bar(page).locator("[data-chip]")).toContainText("Live");
    const t = toolbar(page);
    for (const name of ["Look", "Undo", "See as a visitor", "Job links", "More", "Share"]) await expect(t.getByRole("button", { name, exact: true })).toBeVisible();
    // The bar is exactly as tall as the exhbt editor's, and stays at the top while the page scrolls.
    const h = await bar(page).evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBe(56);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => bar(page).evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  });

  test("at 700 Look, See as a visitor and Job links fold into the menu", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await openEditor(page, fresh(FULL, "bar-narrow"));
    const t = toolbar(page);
    await expect(t.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(bar(page).locator("[data-save]")).toBeVisible();
    for (const name of ["Look", "See as a visitor", "Job links"]) await expect(t.getByRole("button", { name, exact: true })).toHaveCount(0);
    await t.getByRole("button", { name: "More" }).click();
    const menu = page.getByRole("menu");
    for (const name of ["Look", "See as a visitor", "Job links", "Team projects", "Use the step builder"]) await expect(menu.getByRole("menuitem", { name })).toBeVisible();
    // Look from the menu is a sheet, and choosing a look there applies it.
    await menu.getByRole("menuitem", { name: "Look" }).click();
    const sheet = page.locator('[data-sheet="look"]');
    await expect(sheet.getByRole("radio", { name: /Night/ })).toBeVisible();
    await sheet.getByRole("radio", { name: /Night/ }).check();
    await expect.poll(() => valueAt(page, "arrangement.themeId")).toBe("night");
  });

  test("See as a visitor turns the visitor's view on and off", async ({ page }) => {
    await openEditor(page, fresh(FULL, "bar-visitor"));
    const toggle = toolbar(page).getByRole("button", { name: "See as a visitor" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => window.__portfolioEditor!.ui().visitor)).toBe(true);
    await toggle.click();
    await expect.poll(() => page.evaluate(() => window.__portfolioEditor!.ui().visitor)).toBe(false);
  });

  test("the chip says Preview only on Free, and Not online yet with no address or nothing live", async ({ page }) => {
    await newPerson(page, "chip-free");
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "preview");
    await expect(bar(page).locator("[data-chip]")).toContainText("Preview only");
    await expect(toolbar(page).getByRole("button", { name: "Claim your address" })).toBeVisible();
  });

  test("on a paid plan with no address the chip says Not online yet, and the primary button claims one", async ({ page }) => {
    await newPerson(page, "chip-paid", "premium");
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "offline");
    await expect(bar(page).locator("[data-chip]")).toContainText("Not online yet");
  });

  test("with an address and every exhbt hidden, the page is not online", async ({ page }) => {
    const f = fresh({ ...fullFixture("x", null, "max"), exhbts: fullFixture("x", null).exhbts.map((e) => ({ ...e, hidden: true })) }, "chip-hidden");
    await openEditor(page, f);
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "offline");
  });
});

test.describe("The Look menu", () => {
  test("each open look applies at once, is saved, and Undo names it", async ({ page }) => {
    await openEditor(page, fresh(FULL, "look-open"));
    await toolbar(page).getByRole("button", { name: "Look" }).click();
    const menu = page.locator("[data-look-menu]");
    await expect(menu).toBeVisible();
    // A list: each look by name, with its faces named.
    await expect(menu.getByRole("radio")).toHaveCount(8);
    await expect(menu).toContainText("Bricolage Grotesque");
    for (const [name, id] of [
      [/Night/, "night"],
      [/Mono/, "mono"],
      [/Classic/, "classic"],
    ] as const) {
      await menu.getByRole("radio", { name }).check();
      await expect.poll(() => valueAt(page, "arrangement.themeId")).toBe(id);
      await expect(page.locator(`${READY} [data-portfolio-home]`)).toHaveAttribute("data-look", id);
    }
    await expect(page.locator(`${READY} #pe-undo`)).toHaveAccessibleName(/Undo: changed the look to Classic/);
    // A colourway is a swatch under its look.
    await menu.locator('[data-variant-option="classic-burgundy"] input').check();
    await expect.poll(() => valueAt(page, "arrangement.themeId")).toBe("classic-burgundy");
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect((await stateNow(page)).arrangement.themeId).toBe("classic-burgundy");
  });

  test("a locked look previews under a line, is never saved, and is not what a visitor sees", async ({ page }) => {
    await openEditor(page, fresh({ ...fullFixture("x", null, "premium") }, "look-locked"));
    await toolbar(page).getByRole("button", { name: "Look" }).click();
    const menu = page.locator("[data-look-menu]");
    const locked = menu.locator('[data-locked="true"]').first();
    // Premium has some of the looks, not all (themeAllowance).
    await expect(locked).toBeVisible();
    const look = await locked.getAttribute("data-look-option");
    await locked.getByRole("radio").check();
    await expect(page.locator(`${READY} [data-portfolio-home]`)).toHaveAttribute("data-look", look!);
    const line = page.locator("[data-look-preview]");
    await expect(line).toContainText(/Preview of .+, comes with/);
    await expect(line.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/account/billing");
    expect(await valueAt(page, "arrangement.themeId")).toBe("exhbt");
    await page.keyboard.press("Escape");
    await line.getByRole("button", { name: "Back to yours" }).click();
    await expect(line).toHaveCount(0);
    await expect(page.locator(`${READY} [data-portfolio-home]`)).toHaveAttribute("data-look", "exhbt");
  });
});

test.describe("The first minute", () => {
  test("a new person sees the strip, each item goes to its field, and ticks as it is done", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await newPerson(page, "first");
    const strip = page.locator('[data-first-run="wide"]');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("Your page");
    await expect(strip).toContainText("Your first exhbt");
    await strip.getByRole("button", { name: /^One line about you/ }).click();
    await expect.poll(() => focusedPath(page)).toBe("profile.headline");
    await page.keyboard.type("Data analyst in training");
    await expect(strip.locator('[data-todo="headline"]')).toHaveAttribute("data-done", "true");
    await strip.getByRole("button", { name: /^Pick a look/ }).click();
    await expect(page.locator("[data-look-menu]")).toBeVisible();
    await page.locator("[data-look-menu]").getByRole("radio", { name: /Night/ }).check();
    await page.keyboard.press("Escape");
    await expect(strip.locator('[data-todo="look"]')).toHaveAttribute("data-done", "true");
    // Skip goes straight to the second step.
    await strip.getByRole("button", { name: "Skip to your first exhbt" }).click();
    await expect(strip).toHaveAttribute("data-step", "exhbt");
    // Hide keeps it hidden on the next visit.
    await strip.getByRole("button", { name: "Hide this" }).click();
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
    await page.reload();
    await waitReady(page);
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
  });

  test("someone with a name, a headline and exhbts sees no strip", async ({ page }) => {
    await openEditor(page, fresh(FULL, "first-done"));
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
  });

  test("on a narrow window the strip is one line with Next", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await newPerson(page, "first-narrow");
    const strip = page.locator('[data-first-run="narrow"]');
    await expect(strip).toContainText("Step 1 of 2");
    await strip.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => focusedPath(page)).toBe("profile.name");
  });
});

void field;
void call;
