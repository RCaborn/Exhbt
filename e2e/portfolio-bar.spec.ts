import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { FULL, fullFixture } from "./fixtures/portfolio-pages";
import { READY, call, expect, focusedPath, fresh, openEditor, setKind, stateNow, test, valueAt, waitReady, waitSaved } from "./portfolio-editor";

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
    await expect(bar(page).getByRole("heading", { level: 2, name: "Your portfolio" })).toBeVisible();
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

  test("at 700 Look, Undo, See as a visitor and Job links fold into the menu", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await openEditor(page, fresh(FULL, "bar-narrow"));
    const t = toolbar(page);
    await expect(t.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(bar(page).locator("[data-save]")).toBeVisible();
    for (const name of ["Look", "Undo", "See as a visitor", "Job links"]) await expect(t.getByRole("button", { name, exact: true })).toHaveCount(0);
    await t.getByRole("button", { name: "More" }).click();
    const menu = page.getByRole("menu");
    for (const name of ["Undo", "Look", "See as a visitor", "Job links", "Team projects", "Use the step builder"]) await expect(menu.getByRole("menuitem", { name })).toBeVisible();
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
    await expect(strip.getByRole("heading", { name: "Your portfolio in three steps" })).toBeVisible();
    // Three steps, the first already done: signing up was it.
    for (const name of ["Account", "Your page", "Your first exhbt"]) await expect(strip).toContainText(name);
    await expect(strip).toHaveAttribute("data-step", "page");
    await strip.getByRole("button", { name: /^One line about you/ }).click();
    await expect.poll(() => focusedPath(page)).toBe("profile.headline");
    await page.keyboard.type("Data analyst in training");
    await expect(strip.locator('[data-todo="headline"]')).toHaveAttribute("data-done", "true");
    await strip.getByRole("button", { name: /^Pick a look/ }).click();
    await expect(page.locator("[data-look-menu]")).toBeVisible();
    // Free has one look: looking through them, and keeping it, is the choice.
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

  test("someone with a name, a headline, a look of their own and exhbts sees no strip", async ({ page }) => {
    await openEditor(page, fresh(fullFixture("x", "classic"), "first-done"));
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
  });

  test("on a narrow window the strip is one line with Next", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await newPerson(page, "first-narrow");
    const strip = page.locator('[data-first-run="narrow"]');
    await expect(strip).toContainText("Step 2 of 3");
    await strip.getByRole("button", { name: /^Next/ }).click();
    await expect.poll(() => focusedPath(page)).toBe("profile.name");
  });
});

/** A small PNG drawn in the page, for the photo. */
async function png(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 300;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4fe9b4";
    ctx.fillRect(0, 0, 300, 300);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(b64, "base64");
}

test.describe("On the page", () => {
  test("the photo button opens the photo sheet, which adds and removes the photo", async ({ page }) => {
    await newPerson(page, "photo", "premium");
    const button = page.locator(`${READY} [data-photo-button]`).getByRole("button", { name: "Add a photo" });
    await expect(button).toBeVisible();
    await button.click();
    const sheet = page.locator('[data-sheet="photo"]');
    await expect(sheet.getByRole("heading", { name: "Add a photo" })).toBeVisible();
    await sheet.getByTestId("photo-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: await png(page) });
    await expect(sheet.getByRole("status").filter({ hasText: "Photo saved." })).toBeVisible();
    await expect(page.locator(`${READY} [data-portfolio-home] [data-avatar="photo"]`).first()).toBeVisible();
    await expect(page.locator(`${READY} [data-photo-button]`).getByRole("button", { name: "Change your photo" })).toBeAttached();
    await sheet.getByRole("button", { name: "Remove photo" }).click();
    await expect(sheet.getByRole("status").filter({ hasText: "Photo removed." })).toBeVisible();
    await expect(page.locator(`${READY} [data-portfolio-home] [data-avatar="initials"]`).first()).toBeVisible();
  });

  test("Suggest an intro fills the intro from the stand-in, and Undo takes it back", async ({ page }) => {
    await openEditor(page, fresh(FULL, "intro"));
    const before = await valueAt(page, "profile.bio");
    await page.locator(`${READY} [data-tools="intro"]`).getByRole("button", { name: "Suggest an intro" }).click();
    await expect(page.locator("[data-intro-note]")).toContainText("written only from what you’ve told us");
    await expect.poll(() => valueAt(page, "profile.bio")).not.toBe(before);
    await expect(page.locator(`${READY} #pe-undo`)).toHaveAccessibleName("Undo: suggested an intro");
    await waitSaved(page);
    await page.locator(`${READY} #pe-undo`).click();
    await expect.poll(() => valueAt(page, "profile.bio")).toBe(before);
  });

  test("Your links saves each link, shows its problem, and turns LinkedIn on and off", async ({ page }) => {
    await openEditor(page, fresh(FULL, "links"));
    await page.locator(`${READY} [data-tools="contact"]`).getByRole("button", { name: "Your links" }).click();
    const panel = page.locator("[data-links-panel]");
    await expect(panel).toBeVisible();
    const github = panel.getByRole("textbox", { name: /GitHub/ });
    await github.fill("github.com/maya-new");
    await expect.poll(() => valueAt(page, "profile.github")).toBe("github.com/maya-new");
    await waitSaved(page);
    // A link the rules refuse shows its problem at the field, and is not saved.
    await panel.getByRole("textbox", { name: /Email/ }).fill("not an email");
    await expect(panel.locator('[data-path="profile.contactEmail"]')).toContainText(/email/i);
    await expect(page.locator(`${READY} [data-save]`)).toHaveAttribute("data-save", "invalid");
    await panel.getByRole("textbox", { name: /Email/ }).fill("maya@example.com");
    await waitSaved(page);
    const show = panel.getByRole("switch", { name: "Show LinkedIn on your page" });
    const was = await show.isChecked();
    await show.click();
    await expect.poll(() => valueAt(page, "arrangement.header.linkedin")).toBe(!was);
  });
});

test.describe("The address sheet", () => {
  test("on Free it says what a paid plan gives, with the upgrade", async ({ page }) => {
    await newPerson(page, "addr-free");
    await toolbar(page).getByRole("button", { name: "Claim your address" }).click();
    const sheet = page.locator('[data-sheet="address"]');
    await expect(sheet.locator('[data-address="blocked"]')).toBeVisible();
    await expect(sheet).toContainText("a preview only you can see");
    await expect(sheet.getByTestId("upgrade-prompt")).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "Username" })).toHaveCount(0);
  });

  test("on Premium with no address it claims one, and the sheet turns to Share", async ({ page }) => {
    await newPerson(page, "addr-claim", "premium");
    await toolbar(page).getByRole("button", { name: "Claim your address" }).click();
    const sheet = page.locator('[data-sheet="address"]');
    await expect(sheet.locator('[data-address="claim"]')).toBeVisible();
    await expect(sheet.getByTestId("publish-checklist")).toContainText("Choose your address");
    const name = `pe-claim-${Math.random().toString(36).slice(2, 8)}`;
    await sheet.getByRole("textbox", { name: "Username" }).fill(name);
    await expect(sheet.getByText("Available.")).toBeVisible();
    await sheet.getByRole("button", { name: "Claim username" }).click();
    await expect(sheet.locator('[data-address="share"]')).toBeVisible();
    await expect(sheet.locator("[data-address-host]")).toContainText(name);
    // Nothing is live yet, so the address says not found until there is.
    await expect(sheet).toContainText("shows “not found” until you publish an exhbt");
    await expect(toolbar(page).getByRole("button", { name: "Share" })).toBeVisible();
  });

  test("with an address: Copy link, Change and Hide from search", async ({ page }) => {
    await openEditor(page, fresh(fullFixture("x", null, "premium"), "addr-share"));
    await toolbar(page).getByRole("button", { name: "Share" }).click();
    const sheet = page.locator('[data-sheet="address"]');
    await expect(sheet.locator('[data-address="share"]')).toBeVisible();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await sheet.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByText("Link copied", { exact: true }).first()).toBeVisible();
    await sheet.getByRole("button", { name: "Change" }).click();
    await expect(sheet.getByRole("textbox", { name: "Username" })).toBeVisible();
    await expect(sheet).toContainText("redirects to the new one for 30 days");
    const hide = sheet.getByRole("switch", { name: "Hide from search" });
    await hide.click();
    await expect.poll(() => valueAt(page, "profile.hideFromSearch")).toBe(true);
    await waitSaved(page);
  });
});

test.describe("Job links and Team", () => {
  test("Job links on Max with links: each link with Live, its views and Edit, then New job link and the links left", async ({ page }) => {
    const f = fresh({ ...FULL, jobLinks: [{ slug: "northfield-analyst", company: "Northfield Foods", roleTitle: "Graduate Operations Analyst", picks: [{ exhbt: "queue", reason: "A timed trial." }] }] }, "joblinks");
    await openEditor(page, f);
    await toolbar(page).getByRole("button", { name: "Job links" }).click();
    const menu = page.locator("[data-job-links-menu]");
    await expect(menu.locator('[data-job-links="list"]')).toBeVisible();
    await expect(menu).toContainText("Northfield Foods · Graduate Operations Analyst");
    await expect(menu).toContainText("Live");
    await expect(menu).toContainText(/0 views/);
    await expect(menu.getByRole("link", { name: "Edit Northfield Foods · Graduate Operations Analyst" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "New job link" })).toHaveAttribute("href", "/job-links/new");
    await expect(menu).toContainText(/\d+ of \d+ live links left/);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("Job links on Max with none published says to publish first; on Premium, the upgrade line only", async ({ page }) => {
    await newPerson(page, "jl-none", "max");
    await toolbar(page).getByRole("button", { name: "Job links" }).click();
    await expect(page.locator("[data-job-links-menu]")).toContainText("Publish an exhbt first: a job link shows your live exhbts.");
    await page.keyboard.press("Escape");
    await openEditor(page, fresh(fullFixture("x", null, "premium"), "jl-prem"));
    await toolbar(page).getByRole("button", { name: "Job links" }).click();
    const menu = page.locator("[data-job-links-menu]");
    await expect(menu.locator('[data-job-links="upgrade"]')).toBeVisible();
    await expect(menu.getByTestId("upgrade-prompt")).toBeVisible();
    await expect(menu.getByRole("link", { name: "New job link" })).toHaveCount(0);
  });

  test("?open= opens each part once the page is up, and leaves the address", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "openq"), { query: "?open=look" });
    void seeded;
    await expect(page.locator("[data-look-menu]")).toBeVisible();
    await expect(page).toHaveURL(/\/portfolio$/);
    for (const [q, sel] of [
      ["?open=address", '[data-sheet="address"] [data-address]'],
      ["?open=job-links", "[data-job-links-menu]"],
      ["?open=team", "[data-team-sheet]"],
      ["?open=links", "[data-links-panel]"],
      ["#job-links", "[data-job-links-menu]"],
    ] as const) {
      // From another page, as a link in an email arrives: a hash alone on the same page would not load it again.
      await page.goto("about:blank");
      await page.goto(`/portfolio${q}`);
      await waitReady(page);
      await expect(page.locator(sel)).toBeVisible();
    }
  });

  test("Team projects from the menu opens the Team sheet, with what team projects are", async ({ page }) => {
    await openEditor(page, fresh(FULL, "team"));
    await toolbar(page).getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Team projects" }).click();
    const sheet = page.locator('[data-sheet="team"]');
    await expect(sheet.getByRole("heading", { name: "Team projects" }).first()).toBeVisible();
    await expect(sheet).toContainText("each of you can have an exhbt of it");
  });

  test("each part opens by name, as the address's ?open= will open it", async ({ page }) => {
    await openEditor(page, fresh(FULL, "open"));
    for (const [name, sel] of [
      ["look", "[data-look-menu]"],
      ["address", '[data-sheet="address"] [data-address]'],
      ["job-links", "[data-job-links-menu]"],
      ["team", "[data-team-sheet]"],
      ["links", "[data-links-panel]"],
    ] as const) {
      await call(page, "open", name);
      await expect(page.locator(sel)).toBeVisible();
      await call(page, "close");
      await expect(page.locator(sel)).toBeHidden();
    }
  });
});

test.describe("Accessibility", () => {
  test("axe finds nothing with the strip, and with each menu and sheet open", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await newPerson(page, "axe", "premium");
    const check = async (where: string) => {
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), where).toEqual([]);
    };
    await expect(page.locator('[data-first-run="wide"]')).toBeVisible();
    await check("the first-run strip");
    for (const [name, sel] of [
      ["look", "[data-look-menu]"],
      ["address", '[data-sheet="address"] [data-address]'],
      ["photo", "[data-photo-sheet]"],
      ["job-links", "[data-job-links-menu]"],
      ["team", "[data-team-sheet]"],
      ["links", "[data-links-panel]"],
    ] as const) {
      await call(page, "open", name);
      await expect(page.locator(sel)).toBeVisible();
      await check(`the ${name} menu or sheet`);
      await call(page, "close");
      await expect(page.locator(sel)).toBeHidden();
    }
  });
});
