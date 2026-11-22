import { expect, test, type Page } from "@playwright/test";
import { emptyDoc, text, type ExhbtDoc } from "../lib/exhbt/blocks";
import { FORMAT_RULES } from "../lib/exhbt/formats";
import { flowShown, pageItems } from "../lib/exhbt/layouts";
import { boxes, differences, docNow, field, freshName, offered, openDoc, openTiming, READY, renders, sampleDoc, settle, typeIn, waitLive } from "./page-editor";

/*
 * Smoothness (decision 0026, "Smoothness"), checks 1 and 2, on the sample of every layout the editor
 * offers: they count, they do not time, so they gate CI without flaking.
 *  1. Typing re-renders only what was typed in: a key in a finding, a caption or a quote adds one
 *     render to that section and none to anything else; a key in a flowchart box adds one to the
 *     flowchart only; a key in the title or the context line adds one to the shell and none to any
 *     section.
 *  2. Nothing moves when a field takes the focus: every frame, pill, flowchart box, finding and
 *     figure is in the same place before and after, on every layout, including the moment a
 *     formatted field's editor takes over from the words as the page drew them.
 * And the field-sizing fallback: with the mirror forced, a field that wraps to three lines is the same
 * size as with `field-sizing`, to half a pixel.
 */

/** The fields to try on a page, with the unit a key typed in each must render: [path, unit]. */
async function targets(page: Page): Promise<[string, string][]> {
  const doc = await docNow(page);
  const out: [string, string][] = [
    ["title", "shell"],
    ["gap", "shell"],
  ];
  if (flowShown(doc) && doc.flow.length) out.push(["flow.0.step", "flow"]);
  for (const it of pageItems(doc)) {
    if (it.kind === "flow") continue;
    const s = it.s;
    if (s.kind === "findings" && s.items.length && !out.some(([, u]) => u === s.id)) out.push([`sections.${it.index}.items.0`, s.id]);
    if (s.kind === "image" && !out.some(([p]) => p.endsWith(".caption"))) out.push([`sections.${it.index}.caption`, s.id]);
    if (s.kind === "quote") out.push([`sections.${it.index}.text`, s.id]);
  }
  return out;
}

/** Puts the cursor at the end of a field and waits until it is the field (a formatted one has become its editor). */
async function focusEnd(page: Page, path: string) {
  const f = field(page, path);
  await f.scrollIntoViewIfNeeded();
  await f.click();
  const rich = (await f.getAttribute("data-field")) === "rich";
  if (rich) await expect(f.locator(".ProseMirror")).toBeFocused();
  else await expect(f).toBeFocused();
  await page.keyboard.press("End");
}

const frames = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

for (const f of offered()) {
  test.describe(`${FORMAT_RULES[f].name}: smoothness`, () => {
    test("a key typed re-renders only the unit typed in", async ({ page }) => {
      await openDoc(page, freshName("smooth"), sampleDoc(f));
      await waitLive(page);
      const list = await targets(page);
      // Every layout's sample has a finding, a flowchart box, the title and the context line to try.
      expect(list.map(([, u]) => u)).toEqual(expect.arrayContaining(["shell", "flow"]));
      for (const [path, unit] of list) {
        await focusEnd(page, path);
        await frames(page);
        const before = await renders(page);
        await page.keyboard.type("x");
        await frames(page);
        const after = await renders(page);
        const changed = Object.fromEntries(Object.keys({ ...before, ...after }).flatMap((k) => ((after[k] ?? 0) - (before[k] ?? 0) ? [[k, (after[k] ?? 0) - (before[k] ?? 0)]] : [])));
        expect(changed, `a key in ${path}`).toEqual({ [unit]: 1 });
      }
    });

    test("nothing moves when a field takes the focus", async ({ page }) => {
      await openDoc(page, freshName("still"), sampleDoc(f));
      await settle(page);
      // Before the formatted fields' editors start (they start in idle moments), and after: both swaps are checked.
      const fields = await page.locator(`${READY} article [data-path][data-field]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-path")!));
      expect(fields.length).toBeGreaterThan(5);
      const before = await boxes(page, { frames: true });
      for (const path of fields) {
        const el = field(page, path);
        await el.scrollIntoViewIfNeeded();
        await el.click();
        await frames(page);
        expect(differences(before, await boxes(page, { frames: true })), `focus in ${path}`).toEqual([]);
      }
      await waitLive(page);
      await settle(page);
      expect(differences(before, await boxes(page, { frames: true })), "every editor started").toEqual([]);
    });
  });
}

test("a move draws the shell again and no section's part, and every field's path follows its section", async ({ page }) => {
  // A case study whose items each have a row of their own: a move changes every stored index after the first.
  const doc: ExhbtDoc = {
    ...emptyDoc(),
    title: "Shorter queues",
    flow: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }],
    sections: [
      { id: "quote-1", kind: "quote", text: "Calmer at lunch.", name: "Sam Patel", role: "Manager" },
      { id: "reflection-1", kind: "reflection", text: text("Time the evening queue too.") },
      { id: "link-1", kind: "link", href: "https://example.com/code", label: "The code", description: "On GitHub" },
    ],
  };
  await openDoc(page, freshName("move"), doc);
  await waitLive(page);
  const before = await renders(page);
  // The first move on an untouched doc writes the flowchart's marker too, which shifts every index.
  await page.evaluate(() => window.__exhbtEditor!.move("link-1", 0));
  await frames(page);
  const after = await renders(page);
  const changed = Object.fromEntries(Object.keys({ ...before, ...after }).flatMap((k) => ((after[k] ?? 0) - (before[k] ?? 0) ? [[k, (after[k] ?? 0) - (before[k] ?? 0)]] : [])));
  expect(changed).toEqual({ shell: 1 });
  // Every field inside a frame carries that frame's stored index now, in its path and in its id (a formatted field's editor's too).
  const stale = await page.evaluate(() =>
    [...document.querySelectorAll('[data-editor="page"] article [data-section-id]')].flatMap((f) => {
      const own = f.getAttribute("data-path");
      if (!own) return [];
      const paths = [...f.querySelectorAll("[data-path]")].map((el) => el.getAttribute("data-path")!).filter((p) => p.startsWith("sections.") && !p.startsWith(`${own}.`));
      const ids = [...f.querySelectorAll("[id]")].map((el) => el.id).filter((id) => id.startsWith("sections-") && !id.startsWith(`${own.replace(/\./g, "-")}-`));
      return [...paths, ...ids].map((p) => `${own}: ${p}`);
    }),
  );
  expect(stale).toEqual([]);
  // And no attribute anywhere (an id, a label's for, an issue's describedby) still carries the parts' stand-in index (Frame.tsx, FRAME_AT).
  const standIn = await page.evaluate(() =>
    [...document.querySelectorAll('[data-editor="page"] *')].flatMap((el) => [...el.attributes].filter((a) => /sections[.-]-1(\D|$)/.test(a.value)).map((a) => `${el.tagName.toLowerCase()} ${a.name}="${a.value}"`)),
  );
  expect(standIn).toEqual([]);
  expect((await docNow(page)).sections.map((s) => s.id)).toEqual(["link-1", "flow", "quote-1", "reflection-1"]);
  // And typing in a moved field is stored at its new place.
  await typeIn(page, "sections.0.label", "The model code");
  expect(((await docNow(page)).sections[0] as { label: string }).label).toBe("The model code");
});

test("the field-sizing fallback: a field that wraps to three lines is the same size with the mirror", async ({ page }) => {
  const words = "Would a second till at lunch, opened for the busiest hour on weekdays, cut the queue by half for students and staff?";
  const measure = async (grow?: "mirror") => {
    await openTiming(page, "case-study", { grow });
    const title = field(page, "title");
    expect(await title.getAttribute("data-grow")).toBe(grow ?? "css");
    await title.fill(words);
    await frames(page);
    const box = (await title.boundingBox())!;
    const lineHeight = await title.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    return { box, lines: Math.round(box.height / lineHeight) };
  };
  const css = await measure();
  expect(css.lines, "the title wraps to three lines").toBe(3);
  const mirror = await measure("mirror");
  for (const k of ["x", "y", "width", "height"] as const) expect(Math.abs(css.box[k] - mirror.box[k]), k).toBeLessThanOrEqual(0.5);
});
