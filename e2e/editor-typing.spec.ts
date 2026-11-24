import { expect, test, type Page } from "./editor-test";
import { plain, type ExhbtDoc, type RichText } from "../lib/exhbt/blocks";
import { docNow, field, freshName, full, holdRichEditor, openDoc, readStored, READY, sampleDoc, waitSaved } from "./page-editor";

/*
 * Typing on the page before a formatted field's editor has loaded (decision 0026, "Typing in the page's
 * own type"): the field rests as the page draws it, in an element that takes typing, and hands its words
 * and its caret to the editor when that arrives. The editor's chunk is held back the whole time the keys
 * are typed, so every key lands on the resting field; then it is let go, and the typing carries on.
 * The phone's tap is in editor-phone.spec.ts.
 */

/** The words at a path in the doc, as plain text. */
async function wordsAt(page: Page, path: string): Promise<string> {
  const doc = (await docNow(page)) as unknown as Record<string, unknown>;
  let v: unknown = doc;
  for (const k of path.split(".")) v = (v as Record<string, unknown>)[k];
  return plain(v as RichText);
}

const storedAt = (doc: ExhbtDoc, path: string) => {
  let v: unknown = doc;
  for (const k of path.split(".")) v = (v as Record<string, unknown>)[k];
  return plain(v as RichText);
};

/** Each formatted field the brief names: a finding, the context line, a picture's caption. */
const CASES: { name: string; doc: () => ExhbtDoc; path: (d: ExhbtDoc) => string }[] = [
  { name: "a finding", doc: () => full(sampleDoc("case-study")), path: (d) => `sections.${d.sections.findIndex((s) => s.kind === "findings")}.items.0` },
  { name: "the context line", doc: () => full(sampleDoc("case-study")), path: () => "gap" },
  { name: "a picture's caption", doc: () => full(sampleDoc("gallery")), path: (d) => `sections.${d.sections.findIndex((s) => s.kind === "image")}.caption` },
];

for (const c of CASES) {
  test(`${c.name}: a click and typing at once, before the editor has loaded, keep every key in order; the caret carries on in the editor; it is saved`, async ({ page }) => {
    const release = await holdRichEditor(page);
    const doc = c.doc();
    const path = c.path(doc);
    const { id } = await openDoc(page, freshName("typing"), doc);
    const before = await wordsAt(page, path);
    expect(before.length).toBeGreaterThan(0);
    const box = field(page, path);
    await expect(box).not.toHaveAttribute("data-live");

    // A click at the very start of the words puts the caret there; the keys follow at once.
    await box.locator(".xe-rest").click({ position: { x: 1, y: 4 } });
    await page.keyboard.type("Right away, ");
    // To the end, and on.
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(" typed fast, every key.");
    // Still resting: every key was taken by the field before its editor existed.
    await expect(box).not.toHaveAttribute("data-live");
    await expect(box.locator(".xe-rest")).toHaveText(`Right away, ${before} typed fast, every key.`);
    expect(await wordsAt(page, path)).toBe(`Right away, ${before} typed fast, every key.`);

    // The editor arrives: the words and the caret are handed over, and nothing moved.
    const at = await box.boundingBox();
    release();
    await expect(box).toHaveAttribute("data-live", "true");
    await expect(box.locator(".ProseMirror")).toBeFocused();
    expect(await box.boundingBox()).toEqual(at);
    await page.keyboard.type(" Then more.");
    const want = `Right away, ${before} typed fast, every key. Then more.`;
    await expect(box.locator(".ProseMirror")).toHaveText(want);
    expect(await wordsAt(page, path)).toBe(want);
    await waitSaved(page, id);
    expect(storedAt((await readStored(page, id)).working, path)).toBe(want);
  });
}

test("typing that has not finished when the editor arrives goes on in the editor, with nothing lost", async ({ page }) => {
  // The chunk comes while the keys are still being typed.
  const release = await holdRichEditor(page);
  const doc = full(sampleDoc("case-study"));
  const path = `sections.${doc.sections.findIndex((s) => s.kind === "findings")}.items.1`;
  await openDoc(page, freshName("typingmid"), doc);
  const before = await wordsAt(page, path);
  const box = field(page, path);
  await box.locator(".xe-rest").click();
  await page.keyboard.press("ControlOrMeta+End");
  const words = " one two three four five six seven eight nine ten";
  await page.keyboard.type(words.slice(0, 20));
  release();
  await page.keyboard.type(words.slice(20), { delay: 15 });
  await expect(box).toHaveAttribute("data-live", "true");
  await expect(box.locator(".ProseMirror")).toHaveText(`${before}${words}`);
  expect(await wordsAt(page, path)).toBe(`${before}${words}`);
});

test("a resting field takes a paste as plain words, and Enter starts no new paragraph", async ({ page }) => {
  await holdRichEditor(page);
  const doc = full(sampleDoc("case-study"));
  const path = `sections.${doc.sections.findIndex((s) => s.kind === "findings")}.items.0`;
  await openDoc(page, freshName("typingpaste"), doc);
  const before = await wordsAt(page, path);
  const rest = field(page, path).locator(".xe-rest");
  await rest.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await rest.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/html", "<p><b>Bold</b> pasted</p><p>words</p>");
    data.setData("text/plain", "Bold pasted\nwords");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  expect(await wordsAt(page, path)).toBe(`${before}Bold pasted words`);
  await expect(rest.locator("p, b, br")).toHaveCount(0);
  await expect(page.locator(`${READY} .xe-rest:focus`)).toHaveCount(1);
});
