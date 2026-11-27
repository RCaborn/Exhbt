import { devices, type Locator, type Page } from "@playwright/test";
import { FULL } from "./fixtures/portfolio-pages";
import { READY, expect, fresh, openEditor, safariFocus, setKind, test, uiNow, waitReady } from "./portfolio-editor";

/*
 * Where the focus goes when a sheet or a popover of the one-page portfolio editor closes (decision 0031, "The
 * bar"): back to what opened it, whichever way it closes, so a keyboard or a screen reader carries on from there.
 * Each opener the fixtures can reach is pressed, the sheet is closed with Escape (and, for the address sheet and
 * the photo sheet, with the sheet's own close button too), and the focus must be on the opener again; for a choice
 * in the bar's menu, which has gone with the menu, on the menu's button.
 *
 * Every case runs twice: as the browser has it, and under Safari's rule about the focus, which the second half gives
 * the page itself (safariFocus, e2e/editor-test.ts), so an ordinary Chromium run, CI's included, checks what Safari
 * does. There a press gives a button no focus, and the focus goes to the nearest thing round it that takes one, the
 * page's main region (#main, app/(app)/layout.tsx). A sheet hands the focus back to whatever had it when it opened, so
 * an opener that does not take the focus itself sends a keyboard back to the top of the page. The editor's
 * `open(sheet, trigger)` gives it to the opener (components/portfolio-editor/runtime-core.ts), and the bar's popover
 * buttons take it as they are pressed (bar/hooks.ts, usePopoverOpener). Nothing here asks `pressFocuses`: under
 * either rule the focus must come back. (E2E_FOCUS=safari puts both halves under the rule.)
 *
 * Under a finger at a wide window (an iPad in landscape, or the touch project's phone at 1440), Astryx's Popover keeps
 * a second copy of its content while it shrinks back into its button, so what is open, and then closed, is counted by
 * the copies that can be seen.
 *
 * The Team notice's Review (TeamSheet.tsx) opens the Team sheet the same way, but only while someone has asked to
 * join one of the person's exhbts, which no fixture holds: e2e/phase2-teammates.spec.ts makes such a request.
 */

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Your portfolio" });
const more = (page: Page) => toolbar(page).getByRole("button", { name: "More", exact: true });
/** A choice in the bar's menu: a menu item, or under a finger a button in the menu's sheet. */
const choice = (page: Page, name: string) =>
  page.getByRole("menuitem", { name, exact: true }).or(page.getByRole("dialog", { name: "More", exact: true }).getByRole("button", { name, exact: true }));
const sheet = (page: Page, name: string) => page.locator(`dialog[data-sheet="${name}"]`);
const photoButton = (page: Page) => page.locator(`${READY} [data-photo-button]`).getByRole("button");
const linksButton = (page: Page) => page.locator(`${READY} [data-tools="contact"]`).getByRole("button", { name: "Your links", exact: true });

/** A brand-new person: no address, no exhbts, on `plan`, in the editor. */
async function newPerson(page: Page, tag: string, plan: "premium" | "max" = "premium") {
  await setKind(page, "page");
  const email = `pe-focus-${tag}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/dev/plan?plan=${plan}&next=${encodeURIComponent("/portfolio")}`)}`);
  await waitReady(page);
}

/** What has the focus, in words, for a failure's message: "button Share", "div#main", "body". */
const focusNow = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return "body";
    if (a.id) return `${a.tagName.toLowerCase()}#${a.id}`;
    return `${a.tagName.toLowerCase()} ${a.getAttribute("aria-label") ?? (a.textContent ?? "").trim().slice(0, 40)}`;
  });

/** Waits until `target` has the focus; failing that, says where the focus is. */
async function expectFocusOn(page: Page, target: Locator, what: string) {
  await expect
    .poll(async () => ((await target.evaluate((el) => el === document.activeElement).catch(() => false)) ? "on it" : await focusNow(page)), {
      message: `${what}: the focus is back on what opened it`,
      timeout: 5_000,
    })
    .toBe("on it");
}

/** How a person presses: a click with a mouse, a tap with a finger. */
const press = (l: Locator, finger: boolean) => (finger ? l.tap() : l.click());

type Opener = {
  name: string;
  /** What is pressed. */
  opener: (page: Page) => Locator;
  /** For a choice in the bar's menu: the choice; the focus then comes back to the menu's button. */
  choice?: string;
  /** What is open once it is pressed. */
  open: (page: Page) => Locator;
  /** Also closed with the sheet's own close button. */
  closeButton?: boolean;
  /** Done first: the page the opener is on. */
  before?: (page: Page) => Promise<void>;
};

/** Presses the opener, closes what it opened (with Escape, or with its close button), and checks where the focus went. */
async function pressAndClose(page: Page, o: Opener, how: "Escape" | "the close button", finger = false) {
  const opener = o.opener(page);
  await opener.scrollIntoViewIfNeeded();
  await press(opener, finger);
  if (o.choice) await press(choice(page, o.choice), finger);
  const shown = o.open(page).filter({ visible: true });
  await expect(shown.first()).toBeVisible();
  if (how === "Escape") await page.keyboard.press("Escape");
  else await press(shown.first().getByRole("button", { name: "Close", exact: true }).first(), finger);
  await expect(shown, `${o.name}, closed with ${how}: no copy of it is left to see`).toHaveCount(0);
  await expect.poll(async () => (await uiNow(page)).sheet, { message: `${o.name}, closed with ${how}: the editor has nothing open` }).toBe(null);
  await expectFocusOn(page, o.choice ? more(page) : opener, `${o.name}, closed with ${how}`);
}

const SHARE: Opener = { name: "Share", opener: (p) => toolbar(p).getByRole("button", { name: "Share", exact: true }), open: (p) => sheet(p, "address"), closeButton: true };
const PHOTO: Opener = { name: "Change your photo", opener: photoButton, open: (p) => sheet(p, "photo"), closeButton: true };
const TEAM: Opener = { name: "Team projects, in the menu", opener: more, choice: "Team projects", open: (p) => sheet(p, "team") };

// Playwright's Pixel 7 (a touch screen, 412 wide, a coarse pointer), in this project's browser.
const { defaultBrowserType: _browser, ...PHONE } = devices["Pixel 7"];
void _browser;

/** Every case: each opener the fixtures reach, at 1440 with a mouse, at 700 where the bar folds into its menu, and on a phone with a finger. */
function everyOpener() {
  test.describe("At 1440, with a mouse", () => {
    const openers: Opener[] = [
      SHARE,
      PHOTO,
      TEAM,
      { name: "Look", opener: (p) => toolbar(p).getByRole("button", { name: "Look", exact: true }), open: (p) => p.locator("[data-look-menu]") },
      { name: "Job links", opener: (p) => toolbar(p).getByRole("button", { name: "Job links", exact: true }), open: (p) => p.locator("[data-job-links-menu]") },
      { name: "Your links", opener: linksButton, open: (p) => p.locator("[data-links-panel]") },
    ];
    for (const o of openers) {
      test(`${o.name}: the focus comes back to it`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openEditor(page, fresh(FULL, `fo-${o.name}`));
        await pressAndClose(page, o, "Escape");
        if (o.closeButton) await pressAndClose(page, o, "the close button");
      });
    }

    test("Claim your address, before there is one: the focus comes back to it", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await newPerson(page, "claim");
      const claim: Opener = { name: "Claim your address", opener: (p) => toolbar(p).getByRole("button", { name: "Claim your address", exact: true }), open: (p) => sheet(p, "address"), closeButton: true };
      await pressAndClose(page, claim, "Escape");
      await pressAndClose(page, claim, "the close button");
    });

    test("the visitor's page: its Claim your address gets the focus back", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await newPerson(page, "visitor-claim");
      await toolbar(page).getByRole("button", { name: "See as a visitor", exact: true }).click();
      const claim: Opener = { name: "the visitor's Claim your address", opener: (p) => p.locator('[data-not-online="address"]').getByRole("button", { name: "Claim your address", exact: true }), open: (p) => sheet(p, "address") };
      await pressAndClose(page, claim, "Escape");
    });

    test("the first-run strip: A photo and Pick a look give the focus back to the strip's own button", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await newPerson(page, "strip");
      const todo = (id: string) => (p: Page) => p.locator(`${READY} [data-first-run="wide"] [data-todo="${id}"]`).getByRole("button");
      await pressAndClose(page, { name: "the strip's A photo", opener: todo("photo"), open: (p) => sheet(p, "photo") }, "Escape");
      await pressAndClose(page, { name: "the strip's Pick a look", opener: todo("look"), open: (p) => p.locator("[data-look-menu]") }, "Escape");
    });
  });

  test.describe("At 700, where the bar folds into its menu", () => {
    const openers: Opener[] = [
      SHARE,
      TEAM,
      { name: "Look, in the menu", opener: more, choice: "Look", open: (p) => sheet(p, "look") },
      { name: "Job links, in the menu", opener: more, choice: "Job links", open: (p) => sheet(p, "job-links") },
    ];
    for (const o of openers) {
      test(`${o.name}: the focus comes back`, async ({ page }) => {
        await page.setViewportSize({ width: 700, height: 900 });
        await openEditor(page, fresh(FULL, `fo7-${o.name}`));
        await pressAndClose(page, o, "Escape");
        if (o.closeButton) await pressAndClose(page, o, "the close button");
      });
    }
  });

  test.describe("On a phone, with a finger", () => {
    test.use(PHONE);
    const openers: Opener[] = [
      SHARE,
      PHOTO,
      TEAM,
      { name: "Look, in the menu", opener: more, choice: "Look", open: (p) => sheet(p, "look") },
      { name: "Job links, in the menu", opener: more, choice: "Job links", open: (p) => sheet(p, "job-links") },
      { name: "Reorder sections, in the menu", opener: more, choice: "Reorder sections", open: (p) => sheet(p, "reorder") },
      { name: "About me's More", opener: (p) => p.locator(`${READY} [data-section-frame="about"] > [data-pe-tools] [data-act="more"]`), open: (p) => p.getByRole("dialog", { name: "About me", exact: true }) },
      { name: "Your links", opener: linksButton, open: (p) => p.getByRole("dialog", { name: "Your links" }) },
    ];
    for (const o of openers) {
      test(`${o.name}: the focus comes back`, async ({ page }) => {
        await openEditor(page, fresh(FULL, `foph-${o.name}`));
        await pressAndClose(page, o, "Escape", true);
        if (o.closeButton) await pressAndClose(page, o, "the close button", true);
      });
    }
  });
}

test.describe("As the browser has it", () => {
  everyOpener();
});

test.describe("Under Safari's rule about the focus, given by the test", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(safariFocus);
  });
  everyOpener();
});
