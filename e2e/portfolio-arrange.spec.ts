import type { Page } from "@playwright/test";
import { FULL, fullFixture, type PortfolioFixture } from "./fixtures/portfolio-pages";
import { finger } from "./page-editor";
import { HOME, READY, expect, fresh, openEditor, stateNow, test, textbox, typeIn, undoLabel, valueAt, waitReady, waitSaved } from "./portfolio-editor";

// Arranging the page on the page (brief F of docs/briefs/portfolio-first, decision 0031): each
// section's frame and corner toolbar, dragging and moving sections, adding and removing them; the
// exhbts' tiles (open, star, hide, move, drag); the hidden row; the owner-only tiles; the Add tile; the
// vision; and the controls over the lines of education and experience. Each test seeds a portfolio of
// its own and opts its own browser in with the development cookie.

const frame = (page: Page, key: string) => page.locator(`${READY} [data-section-frame="${key}"]`);
const tools = (page: Page, key: string) => frame(page, key).locator(":scope > [data-pe-tools]");
const tile = (page: Page, id: string) => page.locator(`${READY} [data-tile-frame="${id}"]`);
const tileTools = (page: Page, id: string) => tile(page, id).locator(":scope > [data-pe-tools]");
const arrangement = async (page: Page) => (await stateNow(page)).arrangement;
const sections = async (page: Page) => (await arrangement(page)).sections;
/** The exhbts More of my work lists, in the order drawn. */
const workIds = (page: Page) => page.locator(`${READY} [data-section="work"] [data-card]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-card")!));

/** Shows a part's toolbar as a mouse does, by pointing at it. */
async function pointAt(page: Page, key: string) {
  await frame(page, key).scrollIntoViewIfNeeded();
  await frame(page, key).hover({ position: { x: 40, y: 60 } });
}

/** A portfolio with these sections and these words (the full fixture's person and exhbts). */
function withLayout(tag: string, slots: string[], tiles?: Record<string, unknown>, plan: PortfolioFixture["plan"] = "max"): PortfolioFixture {
  const f = fresh(fullFixture("pp-full", null, plan), tag);
  const layout = f.layout as { tiles: Record<string, unknown> };
  return { ...f, layout: { v: 1, slots, tiles: tiles ?? layout.tiles, header: { skills: true, linkedin: true } } };
}

/** Drags with a mouse from the middle of `from` to the middle of `to`, in steps. */
async function mouseDrag(page: Page, from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    await page.mouse.move(from.x + from.width / 2 + ((to.x - from.x - from.width / 2) * i) / 16, from.y + from.height / 2 + ((to.y - from.y - from.height / 2) * i) / 16);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

/** Drags by keyboard from a grip that has the focus: Space, each key, Space, waiting for each to be read out. */
async function keyDrag(page: Page, keys: string[], end: "Space" | "Escape" = "Space") {
  const live = page.locator("[id^=DndLiveRegion]");
  await page.keyboard.press("Space");
  await expect(live.filter({ hasText: "Picked up" })).toHaveCount(1);
  for (const key of keys) {
    await page.keyboard.press(key);
    await expect(live.filter({ hasText: /is over position/ })).toHaveCount(1);
  }
  await page.keyboard.press(end);
  await expect(live.filter({ hasText: end === "Space" ? "Dropped" : "Cancelled" })).toHaveCount(1);
}

test.describe("Sections", () => {
  test.skip(({ isMobile }) => isMobile, "the touch checks are below");

  test("each section has a toolbar over its corner: the grip, Move up, Move down and Remove", async ({ page }) => {
    await openEditor(page, fresh(FULL, "frames"));
    const keys = await sections(page);
    await expect(page.locator(`${READY} [data-section-frame]`)).toHaveCount(keys.length);
    await pointAt(page, "about");
    const bar = tools(page, "about").getByRole("toolbar", { name: "About me: arrange" });
    await expect(bar).toBeVisible();
    for (const name of ["Drag About me", "Move About me up", "Move About me down", "Remove About me"]) await expect(bar.getByRole("button", { name, exact: true })).toBeVisible();
    // One Tab stop: the rest of the toolbar is reached with the arrow keys.
    await expect(bar.locator("button[tabindex='0']")).toHaveCount(1);
    // The first and the last cannot go further, and say so.
    await expect(tools(page, keys[0]!).getByRole("button", { name: "Move My best piece of work up" })).toHaveAttribute("aria-disabled", "true");
    await expect(tools(page, keys.at(-1)!).getByRole("button", { name: "Move Get in touch down" })).toHaveAttribute("aria-disabled", "true");
    // "Add a section" after the last one, where the sections' own problem would show.
    await expect(page.locator(`${READY} [data-path="arrangement.sections"]`).getByRole("button", { name: /Add a section|Every section/ })).toBeVisible();
  });

  test("a section moves by keyboard: Move down, then Space on the grip, the arrows and Space; each with Undo", async ({ page }) => {
    await openEditor(page, fresh(FULL, "keys"));
    const before = await sections(page);
    expect(before.slice(2, 4)).toEqual(["about", "experience"]);
    await pointAt(page, "about");
    await tools(page, "about").getByRole("button", { name: "Move About me down" }).click();
    expect((await sections(page)).slice(2, 4)).toEqual(["experience", "about"]);
    expect(await undoLabel(page)).toBe("moved About me");
    // The focus stays on the button pressed.
    await expect(tools(page, "about").getByRole("button", { name: "Move About me down" })).toBeFocused();
    await page.getByRole("button", { name: "Undo: moved About me" }).click();
    expect(await sections(page)).toEqual(before);

    // The grip, by keyboard: Space picks up, ArrowDown moves, Space drops.
    const grip = tools(page, "about").getByRole("button", { name: "Drag About me" });
    await grip.focus();
    await keyDrag(page, ["ArrowDown"]);
    await expect.poll(async () => (await sections(page)).slice(2, 4)).toEqual(["experience", "about"]);
    expect(await undoLabel(page)).toBe("moved About me");
    // The arrows moved the section, not the focus along the toolbar, and the drop pressed nothing.
    expect((await sections(page)).length).toBe(before.length);
    await waitSaved(page);
    // Escape cancels a drag.
    await tools(page, "about").getByRole("button", { name: "Drag About me" }).focus();
    await keyDrag(page, ["ArrowUp"], "Escape");
    expect((await sections(page)).slice(2, 4)).toEqual(["experience", "about"]);
    await page.reload();
    await waitReady(page);
    expect((await sections(page)).slice(2, 4)).toEqual(["experience", "about"]);
  });

  test("a section is dragged by its grip with a mouse, its lifted copy follows, and Undo puts it back", async ({ page }) => {
    await openEditor(page, fresh(FULL, "mouse"));
    const before = await sections(page);
    // Experience's top and the quote's grip, both in the window.
    await frame(page, "experience").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await frame(page, "quote").hover({ position: { x: 40, y: 60 } });
    const grip = (await tools(page, "quote").getByRole("button", { name: "Drag A quote" }).boundingBox())!;
    const target = (await frame(page, "experience").boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y - 20, { steps: 4 });
    await expect(page.getByTestId("lifted-section")).toBeVisible();
    await page.mouse.move(grip.x + grip.width / 2, target.y + 20, { steps: 16 });
    await page.mouse.up();
    await expect.poll(async () => (await sections(page)).indexOf("quote")).toBe(before.indexOf("experience"));
    expect(await undoLabel(page)).toBe("moved A quote");
    await page.getByRole("button", { name: "Undo: moved A quote" }).click();
    expect(await sections(page)).toEqual(before);
  });

  test("Remove takes a section off with its words, and Undo puts both back", async ({ page }) => {
    await openEditor(page, fresh(FULL, "remove"));
    const words = await valueAt(page, "arrangement.tiles.experience");
    await pointAt(page, "experience");
    await tools(page, "experience").getByRole("button", { name: "Remove Experience" }).click();
    await expect(frame(page, "experience")).toHaveCount(0);
    expect(await sections(page)).not.toContain("experience");
    await page.getByRole("button", { name: "Undo: removed Experience" }).click();
    await expect(frame(page, "experience")).toHaveCount(1);
    expect(await sections(page)).toContain("experience");
    expect(await valueAt(page, "arrangement.tiles.experience")).toEqual(words);
    await expect(textbox(page, "arrangement.tiles.experience.lines.0", { part: "label" })).toHaveValue("Shift supervisor, campus cafe");
  });

  test("Add a section lists the six, dims those on the page, and puts a new one at the end with the cursor in it", async ({ page }) => {
    await openEditor(page, withLayout("add", ["featured", "work", "about", "contact"]));
    await page.locator(`${READY} [data-path="arrangement.sections"]`).getByRole("button", { name: "Add a section" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveCount(6);
    await expect(menu.getByRole("menuitem", { name: /About me/ })).toHaveAttribute("aria-disabled", "true");
    await menu.getByRole("menuitem", { name: /Experience/ }).click();
    expect(await sections(page)).toEqual(["featured", "work", "about", "contact", "experience"]);
    expect(await undoLabel(page)).toBe("added Experience");
    await expect(textbox(page, "arrangement.tiles.experience.lines.0", { part: "label" })).toBeFocused();
    await page.keyboard.type("Barista, Station Cafe");
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect(await sections(page)).toEqual(["featured", "work", "about", "contact", "experience"]);
    expect(await valueAt(page, "arrangement.tiles.experience.lines.0")).toBe("Barista, Station Cafe");
  });

  test("on Free, Experience and Quote are offered with the plan's reason, and cannot be added", async ({ page }) => {
    await openEditor(page, withLayout("locked", ["featured", "work", "about", "contact"], undefined, "free"));
    await page.locator(`${READY} [data-path="arrangement.sections"]`).getByRole("button", { name: "Add a section" }).click();
    const menu = page.getByRole("menu");
    for (const name of [/Experience/, /A quote/]) {
      const item = menu.getByRole("menuitem", { name });
      await expect(item).toHaveAttribute("aria-disabled", "true");
      await expect(item).not.toContainText("Already on your page");
    }
    await expect(page.locator(".pe-menu-foot").getByRole("link", { name: "See plans" })).toBeVisible();
    await menu.getByRole("menuitem", { name: /Experience/ }).click({ force: true });
    expect(await sections(page)).toEqual(["featured", "work", "about", "contact"]);
  });

  test("no section's toolbar covers words, a link or a button of another part", async ({ page }) => {
    await openEditor(page, fresh(FULL, "clash"));
    await expect(page.locator(`${READY} ${HOME}`)).toBeVisible();
    for (const key of await sections(page)) {
      await pointAt(page, key);
      expect(await toolbarClashes(page), key).toEqual([]);
    }
  });
});

test.describe("Sections by touch", () => {
  test.skip(({ isMobile }) => !isMobile, "the mouse and keyboard checks are above");

  test("a press-and-hold on a section's grip drags it, and Undo puts it back", async ({ page }) => {
    await openEditor(page, fresh(FULL, "touch"));
    const before = await sections(page);
    const grip = tools(page, "contact").getByRole("button", { name: "Drag Get in touch" });
    await grip.scrollIntoViewIfNeeded();
    await expect(grip).toBeVisible();
    const a = (await grip.boundingBox())!;
    const target = (await frame(page, "quote").boundingBox())!;
    const f = await finger(page);
    const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    await f.down(from.x, from.y);
    await page.waitForTimeout(300);
    await f.slide(from, { x: from.x, y: target.y + 10 }, 20);
    await f.up();
    await expect.poll(async () => (await sections(page)).indexOf("contact")).toBe(before.indexOf("quote"));
    expect(await undoLabel(page)).toBe("moved Get in touch");
    await page.getByRole("button", { name: "Undo: moved Get in touch" }).click();
    expect(await sections(page)).toEqual(before);
  });
});

test.describe("Exhbt tiles", () => {
  test.skip(({ isMobile }) => isMobile, "desktop");

  test("a tile opens its exhbt, and has the star, Hide, the grip and More over its corner", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "tile"));
    const id = (await workIds(page))[0]!;
    expect(Object.values(seeded.ids)).toContain(id);
    await tile(page, id).hover();
    const bar = tileTools(page, id).getByRole("toolbar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: /^Put .* in the band$/ })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^Hide / })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^Drag / })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^More for / })).toBeVisible();
    await expect(tile(page, id).locator("[data-pe-open]")).toHaveAttribute("href", `/exhbts/${id}/edit`);
    expect(await toolbarClashes(page)).toEqual([]);
  });

  test("tiles move by keyboard and by mouse; the order is stored and is the step builder's after a reload", async ({ page }) => {
    await openEditor(page, fresh(FULL, "tilemove"));
    const before = await workIds(page);
    expect(before.length).toBe(4);
    // More, Move down.
    await tile(page, before[0]!).hover();
    await tileTools(page, before[0]!).getByRole("button", { name: /^More for / }).click();
    await page.getByRole("menuitem", { name: "Move down" }).click();
    await expect.poll(() => workIds(page)).toEqual([before[1], before[0], before[2], before[3]]);
    expect(await undoLabel(page)).toMatch(/^moved /);
    await page.getByRole("button", { name: /^Undo: moved / }).click();
    await expect.poll(() => workIds(page)).toEqual(before);
    // The grip by keyboard: Space, ArrowRight (the next card in the grid), Space.
    await tile(page, before[0]!).hover();
    await tileTools(page, before[0]!).getByRole("button", { name: /^Drag / }).focus();
    await keyDrag(page, ["ArrowRight"]);
    await expect.poll(() => workIds(page)).toEqual([before[1], before[0], before[2], before[3]]);
    // The mouse: the last card onto the first.
    const now = await workIds(page);
    await tile(page, now[3]!).hover();
    const grip = (await tileTools(page, now[3]!).getByRole("button", { name: /^Drag / }).boundingBox())!;
    const first = (await tile(page, now[0]!).boundingBox())!;
    await mouseDrag(page, grip, { x: first.x + 40, y: first.y + 40 });
    await expect.poll(() => workIds(page)).toEqual([now[3], now[0], now[1], now[2]]);
    await waitSaved(page);
    const stored = (await arrangement(page)).order;
    await page.goto("/portfolio?builder=steps&step=projects");
    const rows = await page.locator("[data-testid=tile-list] li[data-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-row")!));
    expect(rows.filter((r) => stored.includes(r))).toEqual(stored.filter((r) => rows.includes(r)));
    expect(rows.slice(1)).toEqual([now[3], now[0], now[1], now[2]]);
  });

  test("the star puts a tile in the band, and the band's star takes it out", async ({ page }) => {
    await openEditor(page, fresh(FULL, "star"));
    const id = (await workIds(page))[2]!;
    await tile(page, id).hover();
    await tileTools(page, id).getByRole("button", { name: /^Put .* in the band$/ }).click();
    expect((await arrangement(page)).featured).toBe(id);
    await expect(page.locator(`${READY} [data-section="featured"] [data-tile-frame="${id}"]`)).toHaveCount(1);
    expect(await workIds(page)).not.toContain(id);
    await pointAt(page, "featured");
    await tools(page, "featured").getByRole("button", { name: /^Take .* out of the band$/ }).click();
    expect((await arrangement(page)).featured).toBe(null);
  });

  test("Hide moves a tile to the hidden row, and Show puts it back", async ({ page }) => {
    await openEditor(page, fresh(FULL, "hide"));
    const id = (await workIds(page))[1]!;
    await tile(page, id).hover();
    await tileTools(page, id).getByRole("button", { name: /^Hide / }).click();
    expect((await arrangement(page)).hidden).toContain(id);
    expect(await workIds(page)).not.toContain(id);
    const row = page.locator(`${READY} [data-hidden-row]`);
    await expect(row).toBeVisible();
    await expect(row.locator(`[data-hidden-key="${id}"]`)).toBeVisible();
    await row.locator(`[data-show="${id}"]`).click();
    expect((await arrangement(page)).hidden).not.toContain(id);
    expect(await workIds(page)).toContain(id);
    await expect(row).toHaveCount(0);
    // Hiding the band's exhbt takes its star off.
    const band = await page.locator(`${READY} [data-section="featured"] [data-tile-frame]`).getAttribute("data-tile-frame");
    await tile(page, (await workIds(page))[0]!).hover();
    await tileTools(page, (await workIds(page))[0]!).getByRole("button", { name: /^Put .* in the band$/ }).click();
    const starred = (await arrangement(page)).featured!;
    expect(starred).not.toBe(band);
    await pointAt(page, "featured");
    await tools(page, "featured").getByRole("button", { name: /^Hide / }).click();
    const a = await arrangement(page);
    expect(a.hidden).toContain(starred);
    expect(a.featured).toBe(null);
  });

  test("on a paid plan a draft is an owner-only tile, never dragged or starred; on Free it is arranged", async ({ page }) => {
    const paid = fresh(FULL, "draft");
    paid.exhbts[4] = { ...paid.exhbts[4]!, draft: true };
    const seeded = await openEditor(page, paid);
    const draftId = seeded.ids[paid.exhbts[4]!.key]!;
    const owner = page.locator(`${READY} [data-owner="owner-only"][data-tile="${draftId}"]`);
    await expect(owner).toBeVisible();
    await expect(owner).toContainText("Draft");
    await expect(owner.getByRole("link", { name: "Finish and publish" })).toHaveAttribute("href", `/exhbts/${draftId}/edit`);
    await expect(owner.getByRole("button")).toHaveCount(0);
    expect(await workIds(page)).not.toContain(draftId);

    const free = fresh(fullFixture("pp-full", null, "free"), "freedraft");
    await openEditor(page, free);
    const ids = await workIds(page);
    expect(ids.length).toBe(4);
    for (const id of ids) await expect(tile(page, id).locator("[data-pe-chip=draft]")).toHaveText("Draft");
    await expect(page.locator(`${READY} [data-owner="owner-only"]`)).toHaveCount(0);
  });

  test("the Add tile gives the two ways to start and the plan's count; when the plan is full, its reason", async ({ page }) => {
    await openEditor(page, fresh(FULL, "addtile"));
    const add = page.locator(`${READY} [data-owner="add"]`);
    await expect(add.getByRole("heading", { name: "Add an exhbt" })).toBeVisible();
    await expect(add.getByRole("link", { name: "Upload your project" })).toHaveAttribute("href", "/exhbts/new");
    await expect(add.getByRole("button", { name: "Or start from a blank page" })).toBeVisible();
    await expect(add.locator("[data-pe-room]")).toHaveText(/^5 of \d+ on \w+/);

    await openEditor(page, fresh(fullFixture("pp-full", null, "free"), "addfull"));
    const full = page.locator(`${READY} [data-owner="add"]`);
    await expect(full).toHaveAttribute("data-full", "true");
    await expect(full.getByRole("status")).toBeVisible();
    await expect(full.getByRole("link", { name: "Upload your project" })).toHaveCount(0);
  });

  test("with no exhbt, the band is the vision with the look's own Add an exhbt, and the work holds the Add tile", async ({ page }) => {
    const none = { ...fresh(FULL, "vision"), exhbts: [], featured: null };
    await openEditor(page, none);
    const band = page.locator(`${READY} [data-section="featured"]`);
    await expect(band.getByRole("heading", { name: "Your best project goes here" })).toBeVisible();
    await expect(band.getByRole("link", { name: "Add an exhbt" })).toHaveAttribute("href", "/exhbts/new");
    await expect(page.locator(`${READY} [data-section="work"] [data-owner="add"]`)).toBeVisible();
  });
});

test.describe("Lines of education and experience", () => {
  test.skip(({ isMobile }) => isMobile, "desktop");

  test("a line is added, typed as two halves stored as one line, moved and removed, each with Undo", async ({ page }) => {
    const f = withLayout("lines", ["featured", "work", "about", "experience", "contact"], { about: { text: "Hello." }, education: { lines: [] }, experience: { lines: ["Shift supervisor, campus cafe, 2024 to now"] } });
    await openEditor(page, f);
    const tools = page.locator(`${READY} [data-pe-lines="experience"]`);
    await expect(tools).toHaveAttribute("data-path", "arrangement.tiles.experience.lines");
    await textbox(page, "arrangement.tiles.experience.lines.0", { part: "label" }).click();
    await tools.getByRole("button", { name: "Add a role" }).click();
    await expect.poll(() => valueAt(page, "arrangement.tiles.experience.lines")).toEqual(["Shift supervisor, campus cafe, 2024 to now", ""]);
    await expect(textbox(page, "arrangement.tiles.experience.lines.1", { part: "label" })).toBeFocused();
    await page.keyboard.type("Summer intern, City Council");
    await typeIn(page, "arrangement.tiles.experience.lines.1", "2025", { part: "year" });
    await expect.poll(() => valueAt(page, "arrangement.tiles.experience.lines.1")).toBe("Summer intern, City Council, 2025");
    // Move it up, from the line's own controls.
    await tools.getByRole("button", { name: "Move line 2 up" }).click();
    expect(await valueAt(page, "arrangement.tiles.experience.lines")).toEqual(["Summer intern, City Council, 2025", "Shift supervisor, campus cafe, 2024 to now"]);
    expect(await undoLabel(page)).toBe("moved line 2");
    // Remove the first.
    await textbox(page, "arrangement.tiles.experience.lines.0", { part: "label" }).click();
    await tools.getByRole("button", { name: "Remove line 1" }).click();
    expect(await valueAt(page, "arrangement.tiles.experience.lines")).toEqual(["Shift supervisor, campus cafe, 2024 to now"]);
    await page.getByRole("button", { name: "Undo: removed line 1" }).click();
    expect(await valueAt(page, "arrangement.tiles.experience.lines")).toEqual(["Summer intern, City Council, 2025", "Shift supervisor, campus cafe, 2024 to now"]);
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect(await valueAt(page, "arrangement.tiles.experience.lines")).toEqual(["Summer intern, City Council, 2025", "Shift supervisor, campus cafe, 2024 to now"]);
  });

  test("a year that is not a year gets a hint under the field while it has the cursor; at the limit there is no Add a line", async ({ page }) => {
    await openEditor(page, fresh(FULL, "yearhint"));
    await expect(page.locator(`${READY} [data-pe-lines="education"]`).getByRole("button", { name: /Add a course/ })).toHaveCount(0);
    await typeIn(page, "arrangement.tiles.education.lines.0", "summer", { part: "year" });
    await expect(page.getByRole("tooltip").filter({ hasText: "This shows as part of the line" })).toBeVisible();
  });
});

/**
 * Every corner toolbar drawn now, hit-tested against the page (copied from e2e/page-editor.ts's
 * `toolbarClashes` and pointed at the portfolio): a toolbar's buttons cover no words of its own part by
 * their glyphs, no words elsewhere by their boxes, and no link, picture or button of another part.
 */
function toolbarClashes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-editor="portfolio"] [data-portfolio-home]');
    if (!root) return ["no editing page"];
    const shown = (t: Element | null) => !t || getComputedStyle(t).opacity !== "0";
    const drawnNow = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const over = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const r = (b: DOMRect) => [b.x, b.y, b.width, b.height].map(Math.round).join(",");
    const frames = [...root.querySelectorAll<HTMLElement>("[data-section-frame], [data-tile-frame]")];
    const toolButtons = (fr: Element) => [...fr.querySelectorAll(":scope > [data-pe-tools] button")].filter((b) => drawnNow(b) && shown(b.closest("[data-pe-tools]")));
    const nameOf = (el: Element) => el.closest("[data-tile-frame]")?.getAttribute("data-tile-frame") ?? el.closest("[data-section-frame]")?.getAttribute("data-section-frame") ?? "the page";
    const worded: { el: Element; boxes: DOMRect[]; glyphs: DOMRect[] }[] = [];
    const range = document.createRange();
    const wordsOf = (n: Node) =>
      [...n.textContent!.matchAll(/\S+/g)].flatMap((w) => {
        range.setStart(n, w.index);
        range.setEnd(n, w.index + w[0].length);
        return [...range.getClientRects()];
      });
    for (const el of root.querySelectorAll("*")) {
      if (el.closest("[data-pe-tools], .sr-only, [hidden], [data-lifted]") || !drawnNow(el)) continue;
      const field = el.matches("textarea, input:not([type=hidden]), [contenteditable]:not([contenteditable=false])");
      const texts = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      const glyphs = field ? [el.getBoundingClientRect()] : texts.flatMap(wordsOf);
      if (field || texts.length) worded.push({ el, boxes: field ? [el.getBoundingClientRect()] : texts.flatMap((n) => (range.selectNodeContents(n), [...range.getClientRects()])), glyphs });
    }
    const out: string[] = [];
    for (const fr of frames) {
      for (const b of toolButtons(fr)) {
        const box = b.getBoundingClientRect();
        const name = `${b.getAttribute("aria-label") ?? "a tool"} (${r(box)})`;
        for (const { el: w, boxes, glyphs } of worded) {
          if (!(fr.contains(w) ? glyphs : boxes).some((q) => over(box, q))) continue;
          out.push(`${name} covers "${(w.matches("textarea, input") ? (w as HTMLTextAreaElement).value : (w.textContent ?? "")).trim().slice(0, 30)}" in ${nameOf(w)}`);
        }
        for (const other of frames) {
          if (other === fr || other.contains(fr) || fr.contains(other)) continue;
          for (const el of other.querySelectorAll("img, button, [data-pe-open]")) {
            if (!shown(el.closest("[data-pe-tools]"))) continue;
            if (drawnNow(el) && over(box, el.getBoundingClientRect())) out.push(`${name} covers a ${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? ""} in ${nameOf(other)}`);
          }
        }
      }
    }
    return [...new Set(out)];
  });
}
