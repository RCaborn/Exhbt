import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { portfolioHost } from "../lib/hosts";

/*
 * The Astryx kit (/dev/astryx, app/dev/astryx) and the app's own wrappers in components/ui: what each one promises,
 * tested where it is drawn. Run: E2E_PORT=3352 npx playwright test e2e/astryx-kit.spec.ts --workers=1
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const URL = "/dev/astryx";

async function open(page: Page) {
  await page.goto(URL);
  await expect(page.getByRole("heading", { level: 1, name: "Astryx kit" })).toBeVisible();
  // The page is drawn on the server; its buttons work once it has hydrated.
  await expect(page.getByRole("button", { name: "Open a dialog" })).toBeEnabled();
}

async function scan(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${label}: ${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

test.describe("the kit page", () => {
  test("axe finds nothing at rest", async ({ page }) => {
    await open(page);
    await scan(page, "rest");
  });

  test("axe finds nothing with a dialog open", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Open a dialog" }).click();
    await expect(page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Done" }) })).toBeVisible();
    await scan(page, "dialog");
  });

  test("axe finds nothing with a menu open", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Choose a layout" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await scan(page, "menu");
  });
});

test.describe("Field", () => {
  test("a TextField with a name posts its value in a plain form, with and without a default", async ({ page }) => {
    await open(page);
    const form = page.getByTestId("field-form");
    await form.getByRole("textbox", { name: "Your name" }).fill("Zed");
    await form.getByRole("button", { name: "Post the form" }).click();
    const posted = JSON.parse((await page.getByTestId("posted").textContent()) ?? "{}");
    expect(posted.plain).toBe("Zed"); // typed, no default
    expect(posted.seeded).toBe("Leeds"); // the default, untouched
    await form.getByRole("textbox", { name: "Your city" }).fill("York");
    await form.getByRole("button", { name: "Post the form" }).click();
    expect(JSON.parse((await page.getByTestId("posted").textContent()) ?? "{}").seeded).toBe("York");
  });

  test("a CheckboxField with a value posts that value when ticked, and nothing when not", async ({ page }) => {
    await open(page);
    const form = page.getByTestId("field-form");
    await form.getByRole("button", { name: "Post the form" }).click();
    expect(JSON.parse((await page.getByTestId("posted").textContent()) ?? "{}")).not.toHaveProperty("own");
    await form.getByRole("checkbox", { name: "This is my own work." }).check();
    await form.getByRole("button", { name: "Post the form" }).click();
    expect(JSON.parse((await page.getByTestId("posted").textContent()) ?? "{}").own).toBe("yes");
  });

  test("required is the browser's own check, and draws no Required mark", async ({ page }) => {
    await open(page);
    const form = page.getByTestId("required-form");
    const field = form.getByRole("textbox", { name: "Pick a name", exact: true }); // the name is the label alone
    await expect(field).toHaveJSProperty("required", true);
    await form.getByRole("button", { name: "Send it" }).click();
    await expect(page.getByTestId("sent")).toHaveText(""); // an empty required field does not post
    await field.fill("Zed");
    await form.getByRole("button", { name: "Send it" }).click();
    await expect(page.getByTestId("sent")).toHaveText("sent");
  });

  test("an error is tied to its field and read out with it", async ({ page }) => {
    await open(page);
    const email = page.getByTestId("field-form").getByRole("textbox", { name: "Email" });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(/Enter a full email address\./);
  });

  test("a label's own words pass through: '(optional)' stays in the name", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("field-form").getByRole("textbox", { name: "Notes (optional)", exact: true })).toBeVisible();
  });

  test("a button reached by Tab has a jade ring, 3px wide and 2px clear", async ({ page }) => {
    await open(page);
    const form = page.getByTestId("field-form");
    // Reached by Tab, as a keyboard does it: the ring is :focus-visible, not :focus.
    await form.getByRole("button", { name: "Post the form" }).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const button = form.getByRole("button", { name: "Post the form" });
    await expect(button).toBeFocused();
    const ring = await button.evaluate((e) => {
      const s = getComputedStyle(e);
      return { style: s.outlineStyle, colour: s.outlineColor, width: s.outlineWidth, offset: s.outlineOffset };
    });
    expect(ring).toEqual({ style: "solid", colour: "rgb(0, 117, 93)", width: "3px", offset: "2px" });
  });

  test("a TextField reached by Tab has the same jade ring", async ({ page }) => {
    test.fixme(true, "Open, reported to 1b's parent: on a focused TextField the native input has outline-style none, so the 3px jade outline never draws. What shows is the control box's own ink edge with a mint halo (the input also carries the page's ink double ring as a box-shadow). Remove this line when the field's ring is jade, and keep the assertion below.");
    await open(page);
    const form = page.getByTestId("field-form");
    await form.getByRole("textbox", { name: "Your name" }).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const field = form.getByRole("textbox", { name: "Your name" });
    await expect(field).toBeFocused();
    const ring = await field.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, colour: s.outlineColor, width: s.outlineWidth, offset: s.outlineOffset };
    });
    expect(ring).toEqual({ style: "solid", colour: "rgb(0, 117, 93)", width: "3px", offset: "2px" });
  });
});

test.describe("Confirm", () => {
  test("says what it is for, and when onConfirm throws it stays open and says so", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Delete, and fail" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("This cannot be undone."); // no body was given
    await dialog.getByRole("button", { name: "Delete it" }).click();
    await expect(dialog).toContainText("That did not work");
    await expect(dialog).toBeVisible();
  });
});

test.describe("Menu", () => {
  test("opened and closed from the keyboard alone, it returns focus to its trigger", async ({ page }) => {
    await open(page);
    const trigger = page.getByRole("button", { name: "Choose a layout" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("an item that is off says why, and is not selectable", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Choose a layout" }).click();
    const off = page.getByRole("menuitem", { name: /Research/ });
    await expect(off).toBeDisabled();
    await expect(off).toContainText("Needs a figure first");
  });
});

test.describe("Notice", () => {
  test("info sits in a status region and error in an alert", async ({ page }) => {
    await open(page);
    const info = page.getByText("A passing note", { exact: true });
    await expect(info.locator("xpath=ancestor::*[@role='status'][1]")).toHaveCount(1);
    const error = page.getByText("We could not save that", { exact: true });
    await expect(error.locator("xpath=ancestor::*[@role='alert'][1]")).toHaveCount(1);
  });
});

test.describe("Sheet on a wide window", () => {
  test("is a drawer at the side; Escape closes it and focus goes back to its button", async ({ page }) => {
    await open(page);
    const opener = page.getByRole("button", { name: "Open an info sheet" });
    await opener.click();
    const sheet = page.locator('[data-sheet="info"]');
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await sheet.boundingBox())?.width ?? 0).toBeLessThan(600);
    const box = (await sheet.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(1430); // against the right edge
    expect(box.height).toBeGreaterThan(850); // full height
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("with reduced motion, opening it leaves nothing animating", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${URL}?only=app-parts`);
    await expect(page.getByRole("button", { name: "Open an info sheet" })).toBeEnabled();
    await page.getByRole("button", { name: "Open an info sheet" }).click();
    await expect(page.locator('[data-sheet="info"]')).toBeVisible();
    await page.waitForTimeout(500);
    const running = await page.evaluate(() => document.getAnimations().map((a) => `${(a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? "?"}:${a.playState}`));
    expect(running).toEqual([]);
  });
});

test.describe("Sheet on a touch phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("an actions sheet is a bottom sheet; Escape closes it and focus goes back", async ({ page }) => {
    await open(page);
    const opener = page.getByRole("button", { name: "Open an actions sheet" });
    await opener.click();
    const sheet = page.locator('[data-sheet="actions"]');
    await expect(sheet).toBeVisible();
    await expect(page.locator('[class*="bottom-sheet"]').first()).toBeAttached();
    // It hugs its short list: the part of the sheet on screen is its content plus its own padding, not a share of
    // the screen. Measured on 390 by 844 with two buttons: content 160.7px, padding 20px + 20px, on screen 202px
    // (about 24% of the height; Astryx's "capped" would be about 62%). The 3px is the sheet's edge.
    const measure = () => sheet.evaluate((content) => {
      const pad = getComputedStyle(content.parentElement!);
      const top = content.closest(".astryx-bottom-sheet")!.getBoundingClientRect().top;
      return { content: content.getBoundingClientRect().height, padding: parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom), onScreen: window.innerHeight - top };
    });
    // It slides in first: wait until it has come to rest.
    await expect.poll(async () => { const m = await measure(); return Math.abs(m.onScreen - (m.content + m.padding)); }).toBeLessThan(3);
    const m = await measure();
    expect(m.padding).toBe(40);
    expect(m.onScreen).toBeLessThan(844 * 0.4);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("a form sheet fills the width; Escape closes it and focus goes back", async ({ page }) => {
    await open(page);
    const opener = page.getByRole("button", { name: "Open a form sheet" });
    await opener.click();
    const sheet = page.locator('[data-sheet="form"]');
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await sheet.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(388);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

test.describe("AddressLine and Steps", () => {
  test("AddressLine draws the name and the host portfolioHost gives", async ({ page }) => {
    await open(page);
    const line = page.locator("p", { hasText: portfolioHost("priya-shah") }).first();
    await expect(line).toHaveText(portfolioHost("priya-shah"));
    await expect(line.locator("span").first()).toHaveText("priya-shah");
  });

  test("AddressLine is drawn in the brand face at 600, on the display step", async ({ page }) => {
    await open(page);
    const line = page.locator("p", { hasText: portfolioHost("priya-shah") }).first();
    const style = await line.evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, weight: s.fontWeight, size: parseFloat(s.fontSize) };
    });
    expect(style.family).toContain("Bricolage");
    expect(style.weight).toBe("600");
    expect(style.size).toBeGreaterThan(40); // display-1 on a wide window
  });

  test("Steps with two steps throws in development", async ({ page }) => {
    await open(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.getByRole("button", { name: /Draw two steps/ }).click();
    await expect.poll(() => errors.join("\n")).toMatch(/at least three steps/);
  });
});

test.describe("AddressLine on a touch phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a name of 30 characters breaks and does not run off the screen", async ({ page }) => {
    await open(page);
    const name = "alexandra-whitfield-robertsons";
    expect(name).toHaveLength(30);
    const box = page.getByTestId("long-address");
    await expect(box).toContainText(name);
    await box.scrollIntoViewIfNeeded();
    const m = await box.evaluate((el) => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, right: el.getBoundingClientRect().right, textRight: Math.max(...[...el.querySelectorAll("span")].map((s) => Math.max(...[...s.getClientRects()].map((r) => r.right)))) }));
    expect(m.scroll).toBeLessThanOrEqual(m.inner);
    expect(m.textRight).toBeLessThanOrEqual(m.right);
  });
});
