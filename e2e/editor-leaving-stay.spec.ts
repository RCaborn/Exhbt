import { expect, test, type Page } from "./editor-test";
import { field, freshName, openDoc, sampleDoc } from "./page-editor";

/*
 * The editor's leave guard (components/exhbt-editor/leaving.ts) when the person stays. The browser asks about unsaved
 * changes, they press "Stay", and the page goes on; the guard must not go on treating the page as one that is being
 * left. Here a real failure of the formatted fields' chunk, after "Stay" and a press, is counted (three tries, then the
 * fallback, as when nobody left); without a press it is still waited out; and the press or key that started the
 * leave, or a held key repeating, does not count as someone staying.
 *
 * "Stay" is made by firing `beforeunload` at the page (a cancelable one, with a listener asking, as the browser's prompt
 * does): the page then simply stays, which is what Stay does. No browser can press the prompt's button for a test.
 */

test.describe.configure({ timeout: 240_000 });

/** The chunk is held until `release()`, then fails every time it is asked for; returns what the test reads. */
async function holdChunk(page: Page) {
  const seen = { asked: 0, fellBack: [] as string[] };
  let released = false;
  let release!: () => void;
  const held = new Promise<void>((done) => (release = done));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("The new editor failed")) seen.fellBack.push(m.text());
  });
  await page.route(/RichEditor/, async (route) => {
    seen.asked++;
    if (!released) await held;
    await route.abort().catch(() => {});
  });
  return {
    seen,
    release: () => {
      released = true;
      release();
    },
  };
}

/** Opens an exhbt, presses a formatted field so the editor waits on the chunk, then makes the page ask "Stay or leave?". */
async function pressedThenAsked(page: Page) {
  const chunk = await holdChunk(page);
  const doc = sampleDoc("case-study");
  await openDoc(page, freshName("stay"), doc);
  await field(page, `sections.${doc.sections.findIndex((s) => s.kind === "findings")}.items.0`).click();
  await expect.poll(() => chunk.seen.asked).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.addEventListener("beforeunload", (e) => e.preventDefault());
    window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
  });
  return chunk;
}

test("after Stay and a key, a real failure of the chunk is counted and reaches the fallback", async ({ page }) => {
  const { seen, release } = await pressedThenAsked(page);
  await page.keyboard.press("Shift");
  release();
  await expect.poll(() => seen.fellBack.length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(seen.asked, "three askings, not one a second").toBeGreaterThanOrEqual(3);
  expect(seen.asked).toBeLessThan(6);
});

test("after Stay and a press, a real failure of the chunk is counted too", async ({ page }) => {
  const { seen, release } = await pressedThenAsked(page);
  await page.mouse.click(2, 2);
  release();
  await expect.poll(() => seen.fellBack.length, { timeout: 30_000 }).toBeGreaterThan(0);
});

test("with no press after Stay, or only the key that started the leave and a held key, a failure is still waited out", async ({ page }) => {
  const { seen, release } = await pressedThenAsked(page);
  // A key pressed before the leave (its event stamped earlier), and a held key repeating: neither is someone staying.
  await page.evaluate(() => {
    const before = new KeyboardEvent("keydown", { key: "r", bubbles: true });
    // The leave was a moment later than this key.
    const t = performance.now();
    while (performance.now() - t < 5) {
      /* wait */
    }
    window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
    window.dispatchEvent(before);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", repeat: true, bubbles: true }));
  });
  release();
  const askedAtRelease = seen.asked;
  // Still asking once a second and no fallback: well past the 2 s the three tries take.
  await expect.poll(() => seen.asked, { timeout: 15_000 }).toBeGreaterThan(askedAtRelease + 3);
  expect(seen.fellBack).toEqual([]);
});
