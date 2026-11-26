import { expect, safariFocus, test, type Page } from "./editor-test";
import { formatOf, FORMAT_RULES, type Format } from "../lib/exhbt/formats";
import { pageItems, rowsFor, type Cell, type Row } from "../lib/exhbt/layouts";
import { docNow, frame, freshName, grip, offered, openDoc, pageOrder, READY, sampleDoc, settle } from "./page-editor";

/*
 * A grip keeps the focus through a drop and through a press with a mouse, under Safari's rule about the focus: a
 * section's (drag/engine.ts) and a flowchart box's (flow/FlowBox.tsx, flow/FlowList.tsx). Their tools show on hover
 * or while the focus is in them, and Safari's engine can lose the hover of whatever a drop has moved in the page under
 * the pointer, until the pointer leaves it. Without the focus, the tools hid under the pointer, and a press where the
 * grip had been went to the words under it (drag/grip.ts; docs/briefs/edit-on-page/r3-notes-from-earlier-agents.md).
 *
 * Every page here has Safari's rule (safariFocus, as e2e/safari.webkit.ts gives it), so the Chromium runs guard it
 * too. Each check moves the pointer off first, so it reads what the focus keeps shown, not the hover: no Chromium
 * loses the hover, so a lost hover itself shows only in WebKit's runs. Desktop project, and WebKit's `safari`.
 */

test.skip(({ isMobile }) => isMobile, "a mouse's");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(safariFocus);
});

/** Tall enough for a whole sample, so a mouse drag never has to scroll. */
const TALL = { width: 1440, height: 3600 };
type Pt = { x: number; y: number };
const middle = (b: { x: number; y: number; width: number; height: number } | null): Pt => ({ x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 });
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => null));
const said = (page: Page) => page.locator(`${READY} [data-said]`);
/** The pointer off the page's sections and boxes: whatever shows now shows by the focus. */
const away = (page: Page) => page.mouse.move(5, 5, { steps: 2 });
/** Whether `tools` is shown and takes a press: its opacity and pointer-events. */
const shown = (page: Page, tools: string) => page.locator(tools).evaluate((t) => `${getComputedStyle(t).opacity}/${getComputedStyle(t).pointerEvents}`);

async function open(page: Page, f: Format, doc = sampleDoc(f)) {
  await page.setViewportSize(TALL);
  await openDoc(page, freshName(`grip${f}`), doc);
  await settle(page);
}

/** A press on `at` and a release with no move (a click), or after a nudge of 3px (still under the drag's 6px). */
async function press(page: Page, at: Pt, nudge = false) {
  await page.mouse.move(at.x, at.y, { steps: 3 });
  await page.mouse.down();
  if (nudge) await page.mouse.move(at.x + 3, at.y + 3, { steps: 3 });
  await page.mouse.up();
}

/* ------------------------------------------------------------------------------------------------
 * A section's grip
 * ---------------------------------------------------------------------------------------------- */

test.describe("a section's grip keeps the focus under Safari's rule, after a mouse drop and a click", () => {
  const lifting = (page: Page) => page.locator(`${READY} [data-xe-drag]`);
  const rowsNow = async (page: Page) => {
    const doc = await docNow(page);
    return rowsFor(pageItems(doc), formatOf(doc));
  };
  const cellIds = (c: Cell) => (c.cell === "item" ? [c.item.id] : c.items.map((x) => x.item.id));
  const tools = (id: string) => `${READY} article [data-section-id="${id}"] > .xe-tools`;
  /** The section's grip, onto the section first and then its grip, as a person goes: pressed and moved past the 6px threshold. */
  async function pickUp(page: Page, id: string) {
    await frame(page, id).hover();
    const g = middle(await grip(page, id).boundingBox());
    await page.mouse.move(g.x, g.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.move(g.x + 4, g.y + 8, { steps: 4 });
    await expect(lifting(page)).toHaveAttribute("data-xe-drag", "pointer");
  }
  /**
   * Section `id` carried by mouse to the top or the end of the page and let go inside the room it lands in, so the
   * pointer is on it once it lands, as when a person drops a section and goes back to its grip.
   */
  async function carry(page: Page, id: string, to: "top" | "end") {
    const order = await pageOrder(page);
    await pickUp(page, id);
    const other = to === "top" ? order.find((x) => x !== id)! : order.filter((x) => x !== id).at(-1)!;
    const b = (await frame(page, other).boundingBox())!;
    const at = to === "top" ? { x: b.x + b.width / 2, y: b.y + 8 } : { x: b.x + b.width / 2, y: b.y + b.height - 8 };
    await page.mouse.move(at.x, at.y, { steps: 12 });
    await expect(said(page)).toHaveText(/would go to place/);
    await page.mouse.up();
    await expect(lifting(page)).toHaveCount(0);
    await settled(page);
    expect(await pageOrder(page)).not.toEqual(order);
  }

  for (const f of offered()) {
    test(`${FORMAT_RULES[f].name}: dropped by mouse, a section keeps its grip in focus and its toolbar shown with the pointer off it, and is picked up again at once; a click or a nudge on its grip keeps them`, async ({ page }) => {
      await open(page, f);
      const id = (await pageOrder(page)).at(-1)!;

      // At rest, a click on the grip, and a nudge under 6px: neither carries anything, and the grip keeps the focus.
      await frame(page, id).hover();
      await press(page, middle(await grip(page, id).boundingBox()));
      await expect(lifting(page)).toHaveCount(0);
      await expect(grip(page, id)).toBeFocused();
      await away(page);
      expect(await shown(page, tools(id))).toBe("1/auto");
      await frame(page, id).hover();
      await press(page, middle(await grip(page, id).boundingBox()), true);
      await expect(lifting(page)).toHaveCount(0);
      await expect(grip(page, id)).toBeFocused();

      // Carried from the end to the top, dropped, and the grip has the focus: the toolbar is shown with the pointer off the section.
      await carry(page, id, "top");
      await expect(grip(page, id)).toBeFocused();
      await away(page);
      expect(await shown(page, tools(id))).toBe("1/auto");

      // Picked up again at once and carried back; the grip has the focus again.
      await carry(page, id, "end");
      await expect(grip(page, id)).toBeFocused();
      await away(page);
      expect(await shown(page, tools(id))).toBe("1/auto");

      // After that drop, a click on the grip with no drag: it keeps the focus, and the toolbar with it.
      await frame(page, id).hover();
      await press(page, middle(await grip(page, id).boundingBox()));
      await expect(lifting(page)).toHaveCount(0);
      await expect(grip(page, id)).toBeFocused();
      await away(page);
      expect(await shown(page, tools(id))).toBe("1/auto");

      // Out of a pair, to the top (or to the end, for a pair that starts the page): drawn anew in its new row, so the focus
      // the press gave its grip went with the old one.
      const pair = (await rowsNow(page)).find((r): r is Extract<Row, { row: "pair" }> => r.row === "pair");
      expect(pair, "every sample has a pair").toBeTruthy();
      const member = cellIds(pair!.left)[0]!;
      await frame(page, member).evaluate((el) => ((el as HTMLElement & { __was?: true }).__was = true));
      await carry(page, member, (await pageOrder(page))[0] === member ? "end" : "top");
      expect(await frame(page, member).evaluate((el) => Boolean((el as HTMLElement & { __was?: true }).__was)), "drawn anew").toBe(false);
      await expect(grip(page, member)).toBeFocused();
      await away(page);
      expect(await shown(page, tools(member))).toBe("1/auto");
    });
  }

  test("dropped where it was, or let go with Escape, a section keeps its grip in focus", async ({ page }) => {
    await open(page, "case-study");
    const order = await pageOrder(page);
    const id = order[1]!;
    await pickUp(page, id);
    await page.mouse.up();
    await expect(said(page)).toHaveText(/dropped where it was/);
    await expect(grip(page, id)).toBeFocused();
    await pickUp(page, id);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(said(page)).toHaveText(/cancelled/);
    await expect(grip(page, id)).toBeFocused();
    await away(page);
    expect(await shown(page, tools(id))).toBe("1/auto");
    expect(await pageOrder(page)).toEqual(order);
  });
});

/* ------------------------------------------------------------------------------------------------
 * A flowchart box's grip
 * ---------------------------------------------------------------------------------------------- */

test.describe("a flowchart box's grip keeps the focus under Safari's rule, after a click and after a drop", () => {
  const LIST = `${READY} article .xe-flow`;
  const BOX = `${READY} article [data-flow-step]`;
  const box = (page: Page, i: number) => page.locator(BOX).nth(i);
  const gripOf = (page: Page, i: number) => box(page, i).locator("[data-flow-grip]");
  const toolsOf = (i: number) => `${BOX}:nth-child(${i + 1}) > .xp-flow-box > .xe-flow-tools`;
  async function pickUp(page: Page, i: number) {
    await box(page, i).hover();
    const g = middle(await gripOf(page, i).boundingBox());
    await page.mouse.move(g.x, g.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.move(g.x + 2, g.y + 2, { steps: 2 });
    await page.mouse.move(g.x + 6, g.y + 6, { steps: 3 });
    await expect(page.locator(LIST)).toHaveAttribute("data-flow-drag", "pointer");
  }

  for (const f of offered()) {
    test(`${FORMAT_RULES[f].name}: a click on a box's grip with no drag, and a nudge under 6px, keep the focus on it, after a drop too, so its tools stay shown with the pointer off the box`, async ({ page }) => {
      const doc = sampleDoc(f);
      // A case study's row holds five boxes at 1440 wide.
      await open(page, f, f === "case-study" ? { ...doc, flow: doc.flow.slice(0, 5) } : doc);
      // The boxes are the list's only items, so :nth-child counts them.
      expect(await page.locator(`${LIST} > ol > li`).count()).toBe(await page.locator(BOX).count());
      const axis = (await page.locator(LIST).getAttribute("data-axis")) as "row" | "column";
      const n = await page.locator(BOX).count();

      // At rest: a click on box 1's grip, then a nudge.
      await box(page, 0).hover();
      await press(page, middle(await gripOf(page, 0).boundingBox()));
      await expect(page.locator(LIST)).not.toHaveAttribute("data-flow-drag", /./);
      await expect(gripOf(page, 0)).toBeFocused();
      await away(page);
      expect(await shown(page, toolsOf(0))).toBe("1/auto");
      await box(page, 0).hover();
      await press(page, middle(await gripOf(page, 0).boundingBox()), true);
      await expect(gripOf(page, 0)).toBeFocused();

      // Box 1 carried to place 3 and dropped: its grip has the focus (FlowList's keepGrip).
      await pickUp(page, 0);
      const r = (await box(page, 2).locator(".xp-flow-box").boundingBox())!;
      const to = axis === "row" ? { x: r.x + r.width * 0.7, y: r.y + r.height / 2 } : { x: r.x + r.width / 2, y: r.y + r.height * 0.7 };
      await page.mouse.move(to.x, to.y, { steps: 15 });
      await expect(said(page)).toHaveText(`The box would go to place 3 of ${n}.`);
      await page.mouse.up();
      await expect(said(page)).toHaveText(`Box dropped in place 3 of ${n}.`);
      await settled(page);
      await expect(gripOf(page, 2)).toBeFocused();

      // Then a click on its grip with no drag, from where the pointer is: the grip keeps the focus, and the tools with it.
      await press(page, middle(await gripOf(page, 2).boundingBox()));
      await expect(gripOf(page, 2)).toBeFocused();
      await away(page);
      expect(await shown(page, toolsOf(2))).toBe("1/auto");
      // And it is picked up again.
      await pickUp(page, 2);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect(said(page)).toHaveText("Moving the box cancelled. It's back where it was.");
      await expect(gripOf(page, 2)).toBeFocused();
    });
  }
});
