import type { Locator, Page } from "@playwright/test";
import { BASE_LOOKS, FULL, fullFixture, type PortfolioFixture } from "./fixtures/portfolio-pages";
import { finger } from "./page-editor";
import { READY, call, expect, fresh, openEditor, setKind, stateNow, test, textbox, undoLabel, waitReady, waitSaved } from "./portfolio-editor";

// The one-page portfolio editor with a thumb (brief I of docs/briefs/portfolio-first, decision 0031,
// "On a phone"), on the touch project (a Pixel 7) and the iPhone: each section's and tile's one More
// button and its sheet of actions, with a one-tap Undo after each; "Reorder sections"; a press-and-hold
// drag on a section's grip and a tile's, and a swipe off the grips that scrolls; the bar's fold; no
// sideways scroll at 320, 390 and 412 in every look; 16px fields; and the first-run strip's one line.

test.skip(({ isMobile }) => !isMobile, "a phone's spec: the touch and iphone projects");

const frame = (page: Page, key: string) => page.locator(`${READY} [data-section-frame="${key}"]`);
const tools = (page: Page, key: string) => frame(page, key).locator(":scope > [data-pe-tools]");
const tile = (page: Page, id: string) => page.locator(`${READY} [data-tile-frame="${id}"]`);
const tileTools = (page: Page, id: string) => tile(page, id).locator(":scope > [data-pe-tools]");
const bar = (page: Page) => page.locator(`${READY} [data-bar]`);
const sections = async (page: Page) => (await stateNow(page)).arrangement.sections;
const workIds = (page: Page) => page.locator(`${READY} [data-section="work"] [data-card]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-card")!));
const names = (page: Page) => page.evaluate(() => window.__portfolioEditor!.state().arrangement.sections);
/** The sheet a More opened: the dialog named for its part. */
const sheet = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
/** The one-tap Undo after a change from a More sheet: a toast with Undo. */
const undoToast = (page: Page, label: string) => page.locator(".astryx-toast").getByRole("button", { name: `Undo: ${label}`, exact: true });
/** The editor's own polite live region (what `say` says). */
const said = (page: Page) => page.locator(`${READY} > [aria-live="polite"][data-said]`);

/** A portfolio with these sections (the full fixture's person and exhbts). */
function withLayout(tag: string, slots: string[]): PortfolioFixture {
  const f = fresh(fullFixture("pp-full", null, "max"), tag);
  const layout = f.layout as { tiles: Record<string, unknown> };
  return {
    ...f,
    layout: {
      v: 1,
      slots,
      tiles: layout.tiles,
      header: { skills: true, linkedin: true },
    },
  };
}

/** Opens a part's More, checks the sheet is the whole screen and every row is 44px, and gives the sheet. */
async function openMore(page: Page, more: Locator, name: string): Promise<Locator> {
  await more.scrollIntoViewIfNeeded();
  const box = (await more.boundingBox())!;
  expect(Math.min(box.width, box.height), `More for ${name} is 44px`).toBeGreaterThanOrEqual(43.5);
  await more.click();
  const s = sheet(page, name);
  await expect(s).toBeVisible();
  const vw = page.viewportSize()!;
  const r = (await s.boundingBox())!;
  expect(r.width, "the sheet is as wide as the screen").toBeGreaterThanOrEqual(vw.width - 1);
  expect(r.height, "and as tall").toBeGreaterThanOrEqual(vw.height - 1);
  for (const b of await s.locator("[data-item-actions] button").all()) {
    const bb = (await b.boundingBox())!;
    expect(bb.height, (await b.getAttribute("aria-label")) ?? "an action").toBeGreaterThanOrEqual(43.5);
  }
  return s;
}

/** The names of a sheet's actions, in order. */
const actionNames = (s: Locator) => s.locator("[data-item-actions] button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")!));

/**
 * What reaches past the window's right edge: the outermost such parts, leaving out a closed sheet (it waits
 * off the screen, fixed) and what is not drawn. The site's own header (components/site/SiteHeader.tsx) is
 * counted apart: it is not the editor's, and at 320 it is 35px too wide for a signed-in person on every
 * page (reported to the main session, not fixed here).
 */
function pastEdge(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const site = (el: Element) => el.closest("body header:not([data-editor] header)");
    const out = [...document.querySelectorAll<HTMLElement>("body *")].filter(
      (el) => el.getClientRects().length && !el.closest("dialog:not([open]), [data-first-run-stand-in], .sr-only") && el.getBoundingClientRect().right > w + 0.5,
    );
    const outer = out.filter((el) => !out.some((o) => o !== el && o.contains(el)));
    return {
      scroll: document.documentElement.scrollWidth,
      w,
      editor: outer.filter((el) => !site(el)).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`),
      header: outer.some((el) => site(el)),
    };
  });
}

test.describe("A section's More", () => {
  test("every section's More offers its actions in order, and a move from it says so, keeps the focus and has a one-tap Undo", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-sec-more"));
    const keys = await sections(page);
    for (const [i, key] of keys.entries()) {
      const name = await frame(page, key).evaluate((el) =>
        el
          .querySelector("[data-act='more']")!
          .getAttribute("aria-label")!
          .replace(/^More for /, ""),
      );
      // Only the grip and More on a phone.
      await expect(tools(page, key).getByRole("button")).toHaveCount(2);
      const s = await openMore(
        page,
        tools(page, key).getByRole("button", {
          name: `More for ${name}`,
          exact: true,
        }),
        name,
      );
      const got = await actionNames(s);
      expect(got[0]).toBe(`Move ${name} up`);
      expect(got[1]).toBe(`Move ${name} down`);
      expect(got.at(-1)).toBe(`Remove ${name}`);
      // At an end, the move it cannot make is dimmed, with its reason read out with it.
      const up = s.getByRole("button", {
        name: `Move ${name} up`,
        exact: true,
      });
      if (i === 0) {
        await expect(up).toHaveAttribute("aria-disabled", "true");
        await expect(up).toHaveAccessibleDescription(`${name} is already at the top`);
        await up.click({ force: true });
        await expect(s).toBeVisible();
        expect(await sections(page)).toEqual(keys);
      }
      const by = i === keys.length - 1 ? -1 : 1;
      const before = await sections(page);
      await s
        .getByRole("button", {
          name: by > 0 ? `Move ${name} down` : `Move ${name} up`,
          exact: true,
        })
        .click();
      await expect(s).not.toBeInViewport();
      await expect.poll(async () => (await sections(page)).indexOf(key)).toBe(i + by);
      expect(await undoLabel(page)).toBe(`moved ${name}`);
      await expect(said(page)).toHaveText(`${name} moved to position ${i + by + 1} of ${keys.length}.`);
      // The focus is back on this part's More, wherever the part now is.
      await expect(
        tools(page, key).getByRole("button", {
          name: `More for ${name}`,
          exact: true,
        }),
      ).toBeFocused();
      // One tap puts it back.
      await undoToast(page, `moved ${name}`).click();
      await expect.poll(() => sections(page)).toEqual(before);
      await expect(page.locator(".astryx-toast")).toHaveCount(0);
    }
  });

  test("Remove from a section's More takes it off, the focus goes to the next section's More, and Undo puts it back", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-sec-remove"));
    const keys = await sections(page);
    const at = keys.indexOf("about");
    const next = keys[at + 1]!;
    const s = await openMore(page, tools(page, "about").getByRole("button", { name: "More for About me" }), "About me");
    await s.getByRole("button", { name: "Remove About me", exact: true }).click();
    await expect.poll(() => sections(page)).toEqual(keys.filter((k) => k !== "about"));
    await expect(said(page)).toHaveText("About me removed. Undo puts it back with its words.");
    await expect(tools(page, next).locator('[data-act="more"]')).toBeFocused();
    await undoToast(page, "removed About me").click();
    await expect.poll(() => sections(page)).toEqual(keys);
    // The Undo is there only until the next action: a tap anywhere else takes it away.
    const s2 = await openMore(page, tools(page, "about").getByRole("button", { name: "More for About me" }), "About me");
    await s2.getByRole("button", { name: "Move About me down", exact: true }).click();
    await expect(undoToast(page, "moved About me")).toBeVisible();
    await page.locator(`${READY} [data-section="about"]`).tap({ position: { x: 4, y: 4 } });
    await expect(page.locator(".astryx-toast")).toHaveCount(0);
    expect(await undoLabel(page)).toBe("moved About me");
  });

  test("the last section's Remove is dimmed with its reason, and does nothing", async ({ page }) => {
    await openEditor(page, withLayout("ph-lone", ["work"]));
    const s = await openMore(
      page,
      tools(page, "work").getByRole("button", {
        name: "More for More of my work",
      }),
      "More of my work",
    );
    const remove = s.getByRole("button", {
      name: "Remove More of my work",
      exact: true,
    });
    await expect(remove).toHaveAttribute("aria-disabled", "true");
    await expect(remove).toHaveAccessibleDescription("Your portfolio keeps at least one section.");
    await expect(s.getByText("Your portfolio keeps at least one section.")).toBeVisible();
    // Off, but still focusable, so its reason is read out with it.
    await remove.focus();
    await expect(remove).toBeFocused();
    await remove.click({ force: true });
    await expect(said(page)).toHaveText("Your portfolio keeps at least one section.");
    expect(await sections(page)).toEqual(["work"]);
    expect(await undoLabel(page)).toBe(null);
    await page.keyboard.press("Escape");
    await expect(s).not.toBeInViewport();
    await expect(
      tools(page, "work").getByRole("button", {
        name: "More for More of my work",
      }),
    ).toBeFocused();
  });

  test("the band's More holds its exhbt's star, Hide and Open, each with Undo", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-band"));
    const band = await frame(page, "featured").locator("[data-tile-frame]").first().getAttribute("data-tile-frame");
    expect(band, "the band shows an exhbt").toBeTruthy();
    const featured = (await stateNow(page)).arrangement.featured;
    const s = await openMore(page, tools(page, "featured").locator('[data-act="more"]'), "My best piece of work");
    const got = await actionNames(s);
    const star = got.find((n) => / in the band$| out of the band$/.test(n))!;
    expect(star).toBeTruthy();
    expect(got.some((n) => n.startsWith("Hide "))).toBe(true);
    expect(got.some((n) => n.startsWith("Open "))).toBe(true);
    await s.getByRole("button", { name: star, exact: true }).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.featured).not.toBe(featured);
    const label = (await undoLabel(page))!;
    expect(label).toMatch(/^(put|took) .* the band$/);
    await undoToast(page, label).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.featured).toBe(featured);

    const s2 = await openMore(page, tools(page, "featured").locator('[data-act="more"]'), "My best piece of work");
    const hide = (await actionNames(s2)).find((n) => n.startsWith("Hide "))!;
    await s2.getByRole("button", { name: hide, exact: true }).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.hidden).toContain(band);
    const hid = (await undoLabel(page))!;
    await undoToast(page, hid).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.hidden).not.toContain(band);
  });
});

test.describe("A tile's More", () => {
  test("every tile's More opens Open, the star, Hide, Move up and Move down; each works with a one-tap Undo", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-tiles"));
    const ids = await workIds(page);
    expect(ids.length).toBeGreaterThan(1);
    for (const [i, id] of ids.entries()) {
      const more = tileTools(page, id).locator('[data-act="more"]');
      const name = (await more.getAttribute("aria-label"))!.replace(/^More for /, "");
      await expect(tileTools(page, id).getByRole("button")).toHaveCount(2);
      const s = await openMore(page, more, name);
      expect(await actionNames(s)).toEqual([`Open ${name}`, `Put ${name} in the band`, `Hide ${name}`, "Move up", "Move down"]);
      if (i === 0) {
        await expect(s.getByRole("button", { name: "Move up", exact: true })).toHaveAccessibleDescription("Already first");
      }
      if (i === ids.length - 1) {
        await expect(s.getByRole("button", { name: "Move down", exact: true })).toHaveAccessibleDescription("Already last");
      }
      const by = i === ids.length - 1 ? -1 : 1;
      await s
        .getByRole("button", {
          name: by > 0 ? "Move down" : "Move up",
          exact: true,
        })
        .click();
      await expect.poll(async () => (await workIds(page)).indexOf(id)).toBe(i + by);
      await expect(tileTools(page, id).locator('[data-act="more"]')).toBeFocused();
      await undoToast(page, `moved ${name}`).click();
      await expect.poll(() => workIds(page)).toEqual(ids);
    }

    // Hide: the tile goes to the hidden row, and the focus to the next tile's More.
    const [first, second] = ids as [string, string];
    const more = tileTools(page, first).locator('[data-act="more"]');
    const name = (await more.getAttribute("aria-label"))!.replace(/^More for /, "");
    let s = await openMore(page, more, name);
    await s.getByRole("button", { name: `Hide ${name}`, exact: true }).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.hidden).toContain(first);
    await expect(tileTools(page, second).locator('[data-act="more"]')).toBeFocused();
    await undoToast(page, `hid ${name}`).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.hidden).not.toContain(first);

    // The star puts it in the band.
    const featured = (await stateNow(page)).arrangement.featured;
    s = await openMore(page, tileTools(page, first).locator('[data-act="more"]'), name);
    await s.getByRole("button", { name: `Put ${name} in the band`, exact: true }).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.featured).toBe(first);
    await undoToast(page, `put ${name} in the band`).click();
    await expect.poll(async () => (await stateNow(page)).arrangement.featured).toBe(featured);
    await waitSaved(page);
  });
});

/** Opens "Reorder sections" from the bar's menu, which a finger gets as a sheet. */
async function openReorder(page: Page): Promise<Locator> {
  await bar(page).getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Reorder sections" })
    .or(page.getByRole("dialog", { name: "More" }).getByRole("button", { name: "Reorder sections" }))
    .click();
  const s = page.getByRole("dialog", { name: "Reorder sections" });
  await expect(s).toBeVisible();
  return s;
}

test.describe("Reorder sections", () => {
  test("a sheet of the sections in order, each with Move up, Move down and a grip; each move has Undo, and Done goes to it", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-reorder"));
    const keys = await sections(page);
    const s = await openReorder(page);
    const vw = page.viewportSize()!;
    const r = (await s.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(vw.width - 1);
    const rows = s.locator("[data-row]");
    await expect(rows).toHaveCount(keys.length);
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-row")))).toEqual(keys);
    for (const b of await s.locator("[data-row] button").all()) {
      const bb = (await b.boundingBox())!;
      expect(Math.min(bb.width, bb.height), (await b.getAttribute("aria-label")) ?? "a button").toBeGreaterThanOrEqual(43.5);
    }
    // The first cannot go up.
    await expect(rows.first().locator('[data-move="up"]')).toBeDisabled();

    await s.getByRole("button", { name: "Move About me down", exact: true }).click();
    const moved = [...keys];
    const at = moved.indexOf("about");
    [moved[at], moved[at + 1]] = [moved[at + 1]!, moved[at]!];
    await expect.poll(() => sections(page)).toEqual(moved);
    await expect(s.getByRole("button", { name: "Move About me down", exact: true })).toBeFocused();
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-row")))).toEqual(moved);
    await expect(s.locator("[data-said]")).toHaveText(`About me moved to position ${at + 2} of ${keys.length}.`);
    // The sheet's own Undo, named for the move.
    await s.getByRole("button", { name: "Undo: moved About me", exact: true }).click();
    await expect.poll(() => sections(page)).toEqual(keys);

    // A press-and-hold on a row's grip drags it within the sheet.
    const grip = s.locator('[data-row="contact"] [data-grip]');
    const g = (await grip.boundingBox())!;
    const target = (await s.locator(`[data-row="${keys[0]}"]`).boundingBox())!;
    const f = await finger(page);
    const from = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
    await f.down(from.x, from.y);
    await page.waitForTimeout(300);
    await f.slide(from, { x: from.x, y: target.y + 4 }, 20);
    await f.up();
    await expect.poll(async () => (await sections(page)).indexOf("contact")).toBe(0);
    expect(await undoLabel(page)).toBe("moved Get in touch");

    await s.getByRole("button", { name: "Done", exact: true }).click();
    await expect(s).not.toBeInViewport();
    await expect(tools(page, "contact").locator('[data-act="more"]')).toBeFocused();
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect((await names(page))[0]).toBe("contact");
  });
});

test.describe("Press and hold", () => {
  test("a press-and-hold on a section's grip lifts and drops it; on a tile's grip the same; a swipe off the grips scrolls", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-drag"));
    const f = await finger(page);
    // A section.
    const before = await sections(page);
    const grip = tools(page, "contact").locator('[data-act="grip"]');
    await grip.scrollIntoViewIfNeeded();
    const a = (await grip.boundingBox())!;
    const target = (await frame(page, "quote").boundingBox())!;
    const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    await f.down(from.x, from.y);
    await page.waitForTimeout(300);
    await expect(page.getByTestId("lifted-section")).toBeVisible();
    await f.slide(from, { x: from.x, y: target.y + 10 }, 20);
    await f.up();
    await expect.poll(async () => (await sections(page)).indexOf("contact")).toBe(before.indexOf("quote"));
    expect(await undoLabel(page)).toBe("moved Get in touch");
    // A drop on a phone gets the one-tap Undo too: an accidental drag is undone with a thumb.
    await undoToast(page, "moved Get in touch").click();
    await expect.poll(() => sections(page)).toEqual(before);

    // A tile: the lifted card's middle onto the next one's (the place a drop is judged by, closest centre).
    const ids = await workIds(page);
    await tile(page, ids[0]!).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -70));
    const tg = tileTools(page, ids[0]!).locator('[data-act="grip"]');
    const t = (await tg.boundingBox())!;
    const own = (await tile(page, ids[0]!).boundingBox())!;
    const to = (await tile(page, ids[1]!).boundingBox())!;
    const tf = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
    const dy = to.y + to.height / 2 - (own.y + own.height / 2);
    const dx = to.x + to.width / 2 - (own.x + own.width / 2);
    await f.down(tf.x, tf.y);
    await page.waitForTimeout(300);
    await f.slide(tf, { x: tf.x + dx, y: Math.min(tf.y + dy + 4, page.viewportSize()!.height - 4) }, 24);
    await page.waitForTimeout(200);
    await f.up();
    await expect.poll(async () => (await workIds(page)).indexOf(ids[0]!)).toBe(1);
    expect(await undoLabel(page)).toMatch(/^moved /);
    await undoToast(page, (await undoLabel(page))!).click();
    await expect.poll(() => workIds(page)).toEqual(ids);

    // A swipe that does not start on a grip scrolls the page (a real finger only: Chromium's).
    if (f.native) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(300);
      const y0 = await page.evaluate(() => window.scrollY);
      // Over the page's own words, nowhere near a grip.
      const start = { x: 40, y: 320 };
      expect(await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x!, y!)?.closest('[data-act="grip"], [data-grip]')), [start.x, start.y])).toBe(false);
      await f.down(start.x, start.y);
      await f.slide(start, { x: start.x, y: start.y - 300 }, 10);
      await f.up();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0 + 100);
      await expect(page.getByTestId("lifted-section")).toHaveCount(0);
    }
  });
});

test.describe("The bar on a phone", () => {
  test("at 320, 360, 390 and 412 the bar keeps the heading, the status and the primary button, sticks while the page scrolls, and nothing overflows", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-bar"));
    for (const width of [320, 360, 390, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(bar(page).getByRole("button", { name: "Share", exact: true })).toBeInViewport({ ratio: 1 });
      await expect(bar(page).locator("[data-save]")).toBeVisible();
      await expect(bar(page).getByRole("button", { name: "More", exact: true })).toBeInViewport({ ratio: 1 });
      const out = await bar(page).evaluate((el) =>
        [...el.querySelectorAll<HTMLElement>("button, [data-chip], [data-save], h2")]
          .filter((n) => n.getClientRects().length && !n.closest(".sr-only"))
          .filter((n) => {
            const r = n.getBoundingClientRect();
            return r.left < -0.5 || r.right > window.innerWidth + 0.5;
          })
          .map((n) => n.getAttribute("aria-label") ?? n.textContent),
      );
      expect(out, `at ${width}`).toEqual([]);
      const wide = await pastEdge(page);
      expect(wide.editor, `at ${width}: what reaches past the edge`).toEqual([]);
      if (width > 320 || !wide.header) expect(wide.scroll, `no sideways scroll at ${width}`).toBeLessThanOrEqual(width);
      // Only the bar sticks: the site's header scrolls away.
      await page.evaluate(() => window.scrollTo(0, 2000));
      await expect.poll(() => bar(page).evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
      const header = page.locator("body > header, [data-site-header]").first();
      if (await header.count()) expect(await header.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    // The rest is in the menu.
    await bar(page).getByRole("button", { name: "More", exact: true }).click();
    const menu = page.getByRole("menu").or(page.getByRole("dialog", { name: "More" }));
    for (const name of ["Undo", "Look", "See as a visitor", "Job links", "Team projects", "Reorder sections"])
      await expect(menu.getByRole("menuitem", { name }).or(menu.getByRole("button", { name })).first()).toBeVisible();
  });
});

test.describe("Every look at a phone's widths", () => {
  for (const look of BASE_LOOKS) {
    test(`${look}: nothing scrolls sideways at 320, 390 and 412, and no field zooms the page when it takes the focus`, async ({ page }) => {
      await openEditor(page, fresh(fullFixture("pp-full", look === "exhbt" ? null : look, "max"), `ph-${look}`));
      if (look !== "exhbt") expect((await stateNow(page)).arrangement.themeId).toMatch(new RegExp(`^${look}`));
      for (const width of [320, 390, 412]) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(150);
        const wide = await pastEdge(page);
        expect(wide.editor, `${look} at ${width}: what reaches past the edge`).toEqual([]);
        if (width > 320 || !wide.header) expect(wide.scroll, `${look} at ${width}: no sideways scroll`).toBeLessThanOrEqual(wide.w);
      }
      await page.setViewportSize({ width: 390, height: 800 });
      // Every field on the page is typed in the page's own type, which has to stay the visitor's page's
      // (a line of education is 15.2px in some looks), so it is not made 16px. iOS would zoom in on such a
      // field when it takes the focus: on an iPhone the editor's viewport says maximum-scale=1 instead
      // (useNoZoomOnFocus, components/exhbt-editor/phone/noZoom.ts), which stops that and still lets a pinch
      // zoom. Android does not zoom on focus, so the rule is set for an iPhone only.
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(`[data-editor="portfolio"] :is(input, textarea, select, [contenteditable="true"])`)]
          .filter((el) => !(el instanceof HTMLInputElement && ["checkbox", "radio", "range", "file", "hidden"].includes(el.type)) && el.getClientRects().length && !el.closest("dialog"))
          .map((el) => ({ path: el.closest("[data-path]")?.getAttribute("data-path") ?? el.getAttribute("aria-label") ?? el.tagName, size: parseFloat(getComputedStyle(el).fontSize) }))
          .filter((f) => f.size < 16),
      );
      const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
      const iphone = await page.evaluate(() => /\b(iPhone|iPod)\b/.test(navigator.userAgent));
      if (iphone) expect(viewport, `${look}: ${small.length} fields under 16px, so an iPhone must not zoom on focus`).toMatch(/maximum-scale=1/);
      else expect(viewport ?? "").not.toMatch(/maximum-scale/);
      test.info().annotations.push({ type: `${look}: page fields under 16px`, description: [...new Set(small.map((f) => `${f.path} ${f.size}px`))].join("; ") || "none" });
    });
  }

  test("every field in the bar's sheets is 16px or more", async ({ page }) => {
    await openEditor(page, fresh(FULL, "ph-sheet-fields"));
    for (const name of ["address", "photo", "links", "team", "job-links", "look"] as const) {
      await call(page, "open", name);
      const s = page.locator(`[data-sheet="${name}"]`);
      if (!(await s.count())) continue;
      await expect(s, `${name} opens`).toBeInViewport();
      await page.waitForTimeout(300);
      const small = await s.evaluate((root) =>
        [...root.querySelectorAll<HTMLElement>("input, textarea, select")]
          .filter((el) => !(el instanceof HTMLInputElement && ["checkbox", "radio", "range", "file", "hidden"].includes(el.type)) && el.getClientRects().length)
          .map((el) => `${el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.tagName}: ${getComputedStyle(el).fontSize}`)
          .filter((f) => parseFloat(f.split(": ")[1]!) < 16),
      );
      expect(small, `${name}: fields under 16px`).toEqual([]);
      const r = await s.boundingBox();
      if (r) expect(r.width, `${name} fills the screen`).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
      await call(page, "close");
      await page.waitForTimeout(450);
    }
  });
});

test.describe("The first minute on a phone", () => {
  test("the strip is one line, Step 2 of 3, and Next goes to the next thing to do", async ({ page }) => {
    await setKind(page, "page");
    const email = `pe-phone-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/portfolio")}`);
    await waitReady(page);
    const strip = page.locator('[data-first-run="narrow"]');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("Step 2 of 3");
    const next = strip.getByRole("button", { name: /^Next/ });
    const nb = (await next.boundingBox())!;
    expect(nb.height).toBeGreaterThanOrEqual(43.5);
    const aim = (await next.getAttribute("aria-label")) ?? "";
    await next.click();
    // Next goes to the step's first thing to do: a field takes the cursor, or its menu opens.
    await expect.poll(async () => page.evaluate(() => Boolean(document.activeElement?.closest("[data-path]")) || Boolean(window.__portfolioEditor!.ui().sheet)), aim).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});

test.describe("Typing on a slow phone", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CPU throttling is Chromium's");

  test("keystroke to paint in the name, the headline and the intro, at 4x CPU, in the full fixture", async ({ page }, info) => {
    await openEditor(page, fresh(FULL, "ph-typing"));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluate(() => {
      const w = window as unknown as { __keyTimes: number[] };
      w.__keyTimes = [];
      document.addEventListener(
        "keydown",
        () => {
          const t0 = performance.now();
          // The next paint after the key: a frame, then a task after it.
          requestAnimationFrame(() => setTimeout(() => w.__keyTimes.push(performance.now() - t0), 0));
        },
        true,
      );
    });
    const report: Record<string, { n: number; median: number; p95: number; max: number }> = {};
    for (const [path, words] of [
      ["profile.name", " Ann"],
      ["profile.headline", " and more words here"],
      ["profile.bio", " A few more words about me, typed key by key."],
    ] as const) {
      const box = textbox(page, path);
      await box.scrollIntoViewIfNeeded();
      await box.click();
      await page.keyboard.press("End");
      await page.evaluate(() => ((window as unknown as { __keyTimes: number[] }).__keyTimes = []));
      await page.keyboard.type(words, { delay: 120 });
      await page.waitForTimeout(400);
      const times = (await page.evaluate(() => (window as unknown as { __keyTimes: number[] }).__keyTimes)).sort((a, b) => a - b);
      const q = (p: number) => Math.round(times[Math.min(times.length - 1, Math.floor(p * times.length))]!);
      report[path] = {
        n: times.length,
        median: q(0.5),
        p95: q(0.95),
        max: Math.round(times.at(-1)!),
      };
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    info.annotations.push({
      type: "typing (ms, keystroke to next paint, 4x CPU)",
      description: JSON.stringify(report),
    });
    console.log("TYPING", JSON.stringify(report));
    for (const r of Object.values(report)) expect(r.n).toBeGreaterThan(2);
  });
});
