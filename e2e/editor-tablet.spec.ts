import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { FORMAT_RULES } from "../lib/exhbt/formats";
import { frame, grip, offered, openTiming, pageOrder, READY, undoLabel, waitLive } from "./page-editor";

/*
 * The editor on a tablet (decision 0026, "The chrome"; docs/briefs/edit-on-page/r3-l-phone.md), on the
 * tablet project: 820 by 1180 with touch, wider than 48rem, so there is no phone bar. Each section's
 * toolbar is shown without hovering and every button in it is 44px (G's rule for a coarse pointer); a
 * 260ms press on a grip picks a section up and a drag moves it (F's); "Reorder sections" is in the top
 * bar's menu (H's) and works (L's sheet).
 */

test.skip(({ isMobile }) => !isMobile, "on the tablet project");

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const sheet = (page: Page) => page.locator(`${READY} dialog[data-sheet="reorder"]`);

// The development build's badge sits at the foot of the screen.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(s);
    });
  });
});

/** Real touch input through the browser, so scrolling and the press delay behave as they do under a finger. */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  return {
    down: (x: number, y: number) => send("touchStart", x, y),
    move: (x: number, y: number) => send("touchMove", x, y),
    up: () => send("touchEnd"),
    async slide(from: { x: number; y: number }, to: { x: number; y: number }, steps = 14) {
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
        await page.waitForTimeout(16);
      }
    },
  };
}
const middle = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const orderWith = (order: string[], id: string, place: number) => {
  const rest = order.filter((x) => x !== id);
  rest.splice(place, 0, id);
  return rest;
};

for (const f of offered()) {
  test(`${FORMAT_RULES[f].name.toLowerCase()}: every section's toolbar is shown without hovering, each button 44px, and there is no phone bar`, async ({ page }) => {
    await openTiming(page, f, { full: true });
    await waitLive(page);
    await expect(page.locator(`${READY} .xe-phonebar`)).toHaveCount(0);
    const found = await page.evaluate(() => {
      const bad: string[] = [];
      const frames = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] article [data-section-id]')];
      for (const fr of frames) {
        const tools = fr.querySelector<HTMLElement>(":scope > .xe-tools");
        if (!tools || getComputedStyle(tools).opacity !== "1" || getComputedStyle(tools).pointerEvents === "none") {
          bad.push(`${fr.dataset.sectionId}: toolbar not shown`);
          continue;
        }
        const buttons = [...tools.querySelectorAll<HTMLElement>("button")].filter((b) => b.getClientRects().length > 0);
        if (!buttons.some((b) => b.hasAttribute("data-grip"))) bad.push(`${fr.dataset.sectionId}: no grip`);
        if (!buttons.some((b) => b.getAttribute("data-tool") === "up")) bad.push(`${fr.dataset.sectionId}: no move up`);
        for (const b of buttons) {
          const r = b.getBoundingClientRect();
          if (Math.round(r.width) < 44 || Math.round(r.height) < 44) bad.push(`${fr.dataset.sectionId}: ${b.getAttribute("aria-label")} is ${r.width}x${r.height}`);
        }
      }
      return { bad, frames: frames.length };
    });
    expect(found.frames).toBeGreaterThan(3);
    expect(found.bad).toEqual([]);
  });
}

test("a 260ms press on a grip picks the section up, and a drag moves it", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  const order = await pageOrder(page);
  const touch = await finger(page);
  await grip(page, "quote-1").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const at = await middle(grip(page, "quote-1"));
  await touch.down(at.x, at.y);
  await page.waitForTimeout(260);
  await touch.move(at.x, at.y + 2);
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveAttribute("data-xe-drag", "pointer");
  // Carried down past the section after it.
  const next = order[order.indexOf("quote-1") + 1]!;
  const b = (await frame(page, next).boundingBox())!;
  await touch.slide(at, { x: at.x, y: b.y + b.height * 0.85 });
  await page.waitForTimeout(250);
  const shown = (await page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null))!;
  expect(shown).toBe(order.indexOf("quote-1") + 1);
  await touch.up();
  await expect.poll(() => pageOrder(page)).toEqual(orderWith(order, "quote-1", shown));
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);
  expect(await undoLabel(page)).toBe("move quote");
});

test("Reorder sections is in the top bar's menu, and its sheet moves sections by button and by a drag", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  const order = await pageOrder(page);
  await page.getByRole("button", { name: "Menu" }).tap();
  await page.getByRole("button", { name: "Reorder sections" }).tap();
  await expect(sheet(page)).toBeVisible();
  expect(await sheet(page).locator("[data-row]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-row")))).toEqual(order);
  expect(await new AxeBuilder({ page }).include('[data-editor="page"]').withTags(WCAG).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);

  // Every control in the sheet takes a thumb.
  const small = await sheet(page)
    .locator("button")
    .evaluateAll((bs) =>
      bs
        .filter((b) => b.getClientRects().length)
        .map((b) => ({ name: b.getAttribute("aria-label") ?? b.textContent?.trim(), r: b.getBoundingClientRect() }))
        .filter(({ r }) => Math.round(r.width) < 44 || Math.round(r.height) < 44)
        .map(({ name, r }) => `${name} ${r.width}x${r.height}`),
    );
  expect(small).toEqual([]);

  await sheet(page).getByRole("button", { name: "Move Flowchart down" }).tap();
  const one = [order[1]!, order[0]!, ...order.slice(2)];
  await expect.poll(() => pageOrder(page)).toEqual(one);
  await expect(sheet(page).getByRole("button", { name: "Move Flowchart down" })).toBeFocused();

  const touch = await finger(page);
  const from = await middle(sheet(page).locator('[data-row="reflection-1"] .xe-reorder-grip'));
  const row = (await sheet(page).locator('[data-row="reflection-1"]').boundingBox())!.height + 8;
  await touch.down(from.x, from.y);
  await page.waitForTimeout(260);
  await touch.move(from.x, from.y - 2);
  await touch.slide(from, { x: from.x, y: from.y - row * 3 });
  await page.waitForTimeout(250);
  await touch.up();
  const r = one.indexOf("reflection-1");
  await expect.poll(() => pageOrder(page)).toEqual(orderWith(one, "reflection-1", r - 3));
  expect(await undoLabel(page)).toBe("move what i'd do next");

  await sheet(page).getByRole("button", { name: "Done" }).tap();
  await expect(sheet(page)).toBeHidden();
  await expect(grip(page, "reflection-1")).toBeFocused();
  const box = (await frame(page, "reflection-1").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
