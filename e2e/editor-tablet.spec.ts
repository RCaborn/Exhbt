import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { FORMAT_RULES } from "../lib/exhbt/formats";
import { frame, grip, offered, openTiming, pageOrder, READY, toolbarClashes, undoLabel, waitLive } from "./page-editor";

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

/**
 * Each section's toolbar as drawn now: shown, with each button 44px. A tile in the gallery's grid
 * (`tiles`: "grip" at rest, "all" with the focus in it) shows only its grip, or every button, and all
 * of it inside the tile's own box; every other section shows its grip, Move up and the rest.
 */
const toolbarsNow = (page: Page, tiles: "grip" | "all") =>
  page.evaluate((tiles) => {
    const bad: string[] = [];
    const frames = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] article [data-section-id]')];
    for (const fr of frames) {
      const id = fr.dataset.sectionId!;
      const tools = fr.querySelector<HTMLElement>(":scope > .xe-tools");
      if (!tools || getComputedStyle(tools).opacity !== "1" || getComputedStyle(tools).pointerEvents === "none") {
        bad.push(`${id}: toolbar not shown`);
        continue;
      }
      const buttons = [...tools.querySelectorAll<HTMLElement>("button")].filter((b) => b.getClientRects().length > 0);
      if (!buttons.some((b) => b.hasAttribute("data-grip"))) bad.push(`${id}: no grip`);
      const tile = fr.dataset.as === "tile";
      if (tile && tiles === "grip" && buttons.length !== 1) bad.push(`${id}: a tile shows ${buttons.map((b) => b.getAttribute("aria-label")).join(", ")}`);
      if ((!tile || tiles === "all") && !buttons.some((b) => b.getAttribute("data-tool") === "up")) bad.push(`${id}: no move up`);
      const box = fr.getBoundingClientRect();
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        if (Math.round(r.width) < 44 || Math.round(r.height) < 44) bad.push(`${id}: ${b.getAttribute("aria-label")} is ${r.width}x${r.height}`);
        if (tile && (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5)) bad.push(`${id}: ${b.getAttribute("aria-label")} is outside its tile`);
      }
    }
    return { bad, frames: frames.length, tiles: frames.filter((fr) => fr.dataset.as === "tile").length };
  }, tiles);

for (const f of offered()) {
  test(`${FORMAT_RULES[f].name.toLowerCase()}: every section's toolbar is shown without hovering, each button 44px, a tile's only its grip until it has the focus; none covers another section; no phone bar`, async ({ page }) => {
    await openTiming(page, f, { full: true });
    await waitLive(page);
    await expect(page.locator(`${READY} .xe-phonebar`)).toHaveCount(0);
    const found = await toolbarsNow(page, "grip");
    expect(found.frames).toBeGreaterThan(3);
    expect(found.bad).toEqual([]);
    // Shown all the time on a tablet, so none may lie over another section's words, pictures or controls, nor a chip (the review's vision-1).
    expect(await toolbarClashes(page)).toEqual([]);
    if (!found.tiles) return;
    // With the focus in a tile (its grip, from a keyboard), its other buttons show too, inside the tile, still covering nothing of another's.
    const tile = page.locator(`${READY} article [data-as="tile"]`).last();
    const id = await tile.getAttribute("data-section-id");
    await tile.locator("[data-grip]").focus();
    const focused = await toolbarsNow(page, "all");
    expect(focused.bad.filter((b) => b.startsWith(`${id}:`))).toEqual([]);
    expect(await toolbarClashes(page)).toEqual([]);
  });
}

test("research with two reference lines, one under the other: no toolbar covers the line above, the References heading or a Web address chip", async ({ page }) => {
  await openTiming(page, "research", { full: true });
  await waitLive(page);
  const n = (await pageOrder(page)).length;
  expect(await page.evaluate((at) => window.__exhbtEditor!.insert("link", at), n)).toBeTruthy();
  await expect.poll(async () => (await pageOrder(page)).length).toBe(n + 1);
  expect(await toolbarClashes(page)).toEqual([]);
});

test("a 260ms press on a tile's grip, in its corner, picks the picture up where it is: the place shown is its own", async ({ page }) => {
  await openTiming(page, "gallery", { full: true });
  await waitLive(page);
  const order = await pageOrder(page);
  const tiles = await page.locator(`${READY} article [data-as="tile"]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-section-id")!));
  const touch = await finger(page);
  for (const id of [tiles[0]!, tiles[tiles.length - 1]!]) {
    await grip(page, id).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    // The grip is in the tile's own top right corner.
    const g = (await grip(page, id).boundingBox())!;
    const t = (await frame(page, id).boundingBox())!;
    expect(g.y).toBeGreaterThanOrEqual(t.y);
    expect(g.x + g.width).toBeLessThanOrEqual(t.x + t.width);
    const at = await middle(grip(page, id));
    await touch.down(at.x, at.y);
    await page.waitForTimeout(260);
    await touch.move(at.x, at.y + 2);
    await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveAttribute("data-xe-drag", "pointer");
    expect(await page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null), id).toBe(order.indexOf(id));
    await touch.move(at.x + 3, at.y + 5);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null), id).toBe(order.indexOf(id));
    await touch.up();
    await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);
    expect(await pageOrder(page)).toEqual(order);
  }
});

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
