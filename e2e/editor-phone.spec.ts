import AxeBuilder from "@axe-core/playwright";
import { DRAFT_WITH_AI } from "./add-exhbt";
import { expect, test, type Locator, type Page } from "./editor-test";
import { plain, text, type ExhbtDoc, type RichText, type Section } from "../lib/exhbt/blocks";
import { FORMAT_RULES } from "../lib/exhbt/formats";
import {
  allowEditOnly,
  boxes,
  chooseAll,
  differences,
  docNow,
  field,
  focusedPath,
  finger,
  flowChipsNearWords,
  frame,
  freshName,
  full,
  grip,
  holdRichEditor,
  offered,
  openDoc,
  openTiming,
  pageOrder,
  plusClashes,
  png,
  READY,
  sampleDoc,
  seeAsVisitor,
  settle,
  smallPresses,
  typeIn,
  undoLabel,
  waitLive,
  waitSaved,
} from "./page-editor";

/*
 * The editor on a phone (decision 0026, "On a phone"; docs/briefs/edit-on-page/r3-l-phone.md), on the
 * touch project (a Pixel 7: 412 wide, a coarse pointer). Each section shows only its grip; the bar at
 * the foot of the screen follows the section in focus and holds its actions, the formatting buttons
 * while a formatted field has the cursor, and "Undo <what>" after a move or a remove; "Reorder
 * sections" is a sheet of rows; the bar sits on the on-screen keyboard and keeps the line being typed
 * clear of it; the status line sits above it; nothing scrolls sideways; every control takes a thumb;
 * the page is the visitor's box for box; axe.
 *
 * The on-screen keyboard can't be opened in a browser driven here: its test stands in a smaller visual
 * viewport. A real phone is still needed for it (the report says what to try).
 */

test.skip(({ isMobile }) => !isMobile, "on the touch project (a Pixel 7)");

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BAR = `${READY} .xe-phonebar`;
const bar = (page: Page) => page.locator(BAR);
const onBar = (page: Page, name: string | RegExp) => bar(page).getByRole("button", { name, exact: typeof name === "string" });
const sheet = (page: Page) => page.locator(`${READY} dialog[data-sheet="reorder"]`);
const scan = async (page: Page) => (await new AxeBuilder({ page }).include('[data-editor="page"]').withTags(WCAG).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);

// The development build's badge sits at the foot of the screen, over the bar's left end.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(s);
    });
  });
});

/** The bar follows a section: a tap on its grip (a quick tap picks nothing up). */
async function choose(page: Page, id: string) {
  await grip(page, id).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await grip(page, id).tap();
  await expect(bar(page)).toHaveAttribute("aria-label", /: tools$/);
}


const middle = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const rect = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);

/* ------------------------------------------------------------------------------------------------
 * Quieter sections, and the bar following the section in focus
 * ---------------------------------------------------------------------------------------------- */

test.describe("each section shows only its grip", () => {
  for (const f of offered()) {
    test(`${FORMAT_RULES[f].name.toLowerCase()}: one 44px grip a section, no other toolbar button, and no grip over another section`, async ({ page }) => {
      await openTiming(page, f, { full: true });
      await waitLive(page);
      const found = await page.evaluate(() => {
        const shown = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0;
        const frames = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] article [data-section-id]')];
        const bad: string[] = [];
        for (const fr of frames) {
          const id = fr.dataset.sectionId!;
          const tools = fr.querySelector(":scope > .xe-tools");
          const buttons = tools ? [...tools.querySelectorAll("button")].filter(shown) : [];
          if (buttons.length !== 1 || !buttons[0]!.hasAttribute("data-grip")) bad.push(`${id}: ${buttons.map((b) => b.getAttribute("aria-label")).join(", ")}`);
          const g = buttons[0]?.getBoundingClientRect();
          if (g && (Math.round(g.width) < 44 || Math.round(g.height) < 44)) bad.push(`${id}: grip ${g.width}x${g.height}`);
          if (!g) continue;
          // Over: by more than half a pixel both ways, as the editor itself and toolbarClashes count it (Toolbar.tsx, page-editor.ts).
          // A word's box is as tall as its line and its bottom edge lands within a pixel of a grip's top; where on that pixel differs by browser.
          const over = (b: DOMRect) => Math.min(g.right, b.right) - Math.max(g.left, b.left) > 0.5 && Math.min(g.bottom, b.bottom) - Math.max(g.top, b.top) > 0.5;
          // No grip lies over words outside its own section, nor over another section's pictures or controls, nor over a control of its own section.
          const article = fr.closest("article")!;
          const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const parent = n.parentElement!;
            if (!n.textContent?.trim() || fr.contains(n) || !shown(parent) || parent.closest(".sr-only, .xe-tools")) continue;
            // Word by word, as toolbarClashes reads them (page-editor.ts): the space hanging at the end of a wrapped line is no word.
            const range = document.createRange();
            for (const word of n.textContent.matchAll(/\S+/g)) {
              range.setStart(n, word.index);
              range.setEnd(n, word.index + word[0].length);
              const hit = [...range.getClientRects()].find(over);
              if (!hit) continue;
              const at = (r: DOMRect) => [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(",");
              bad.push(`${id}'s grip (${at(g)}) is over "${word[0]}" (${at(hit)}) in ${parent.closest("[data-section-id]")?.getAttribute("data-section-id") ?? "the page"}`);
              break;
            }
          }
          for (const other of frames) {
            if (other === fr) continue;
            for (const el of other.querySelectorAll("img, button, a[href]")) if (shown(el) && over(el.getBoundingClientRect())) bad.push(`${id}'s grip is over a ${el.tagName.toLowerCase()} in ${other.dataset.sectionId}`);
          }
          for (const el of fr.querySelectorAll("button:not([data-grip]), a[href]")) if (shown(el) && !el.closest(".xe-tools") && over(el.getBoundingClientRect())) bad.push(`${id}'s grip is over its own ${el.getAttribute("aria-label") ?? el.textContent?.trim()}`);
        }
        // What the bar carries is not drawn on the page.
        for (const sel of ["[data-tool]", ".xe-list-tools", ".xe-shell-tools", ".xe-format"]) {
          const seen = [...document.querySelectorAll('[data-editor="page"] article ' + sel)].filter(shown);
          if (seen.length) bad.push(`${sel} shown ${seen.length} times`);
        }
        return { bad, frames: frames.length };
      });
      expect(found.frames).toBeGreaterThan(3);
      expect(found.bad).toEqual([]);
    });
  }

  test("the bar names the part in focus: a section, the title, the context line, the skills; with none, Add and Reorder", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    await expect(bar(page)).toBeVisible();
    await expect(bar(page)).toHaveAttribute("aria-label", "Section tools");
    await expect(onBar(page, "Add a section at the end")).toBeVisible();
    await expect(onBar(page, "Reorder sections")).toBeVisible();

    await choose(page, "graph-1");
    await expect(bar(page)).toHaveAttribute("aria-label", "Graph 1: tools");
    await expect(bar(page).locator(".xe-bar-name")).toHaveText("Graph 1");
    // The grip a finger just left shows no tooltip (one at the right edge would widen the page and zoom it out).
    await page.waitForTimeout(300);
    expect(await grip(page, "graph-1").evaluate((el) => getComputedStyle(el, "::after").content)).toBe("none");
    expect(await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth])).toEqual([page.viewportSize()!.width, 0]);
    for (const name of ["Move Graph 1 up", "Move Graph 1 down", "Remove Graph 1", "Reorder sections"]) await expect(onBar(page, name)).toBeVisible();

    // A tap on a part with no field follows it too: the graph's drawing (which opens its figures; closed, the bar is on it).
    await frame(page, "graph-2").locator(".xe-fig-graph").tap();
    const chart = page.locator(`${READY} dialog[data-sheet="chart"]`);
    await expect(chart).toBeVisible();
    await chart.getByRole("button", { name: "Close" }).tap();
    await expect(chart).toBeHidden();
    await expect(bar(page)).toHaveAttribute("aria-label", "Graph 2: tools");

    // The flowchart in a case study is taken off like any other part (decision 0032: nothing has to be on the page).
    // Until then its Remove was there but off, and a tap said why.
    await choose(page, "flow");
    await expect(bar(page)).toHaveAttribute("aria-label", "Flowchart: tools");
    await expect(onBar(page, "Remove Flowchart")).not.toHaveAttribute("aria-disabled", "true");
    await expect(onBar(page, "Remove Flowchart")).toHaveAccessibleDescription("");
    await onBar(page, "Remove Flowchart").tap();
    await expect(frame(page, "flow")).toHaveCount(0);
    expect((await docNow(page)).flowOff).toBe(true);

    // A plain field in the title: the bar names the part (its More actions show only where the AI drafted it).
    await field(page, "title").tap();
    await expect(bar(page)).toHaveAttribute("aria-label", "Your question and details: tools");
    await field(page, "skills").getByLabel("Add a skill").tap();
    await expect(bar(page)).toHaveAttribute("aria-label", "Skills used: tools");
  });

  test("with no section chosen, Add opens the + at the end of the page, its menu clear of the bar", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    await onBar(page, "Add a section at the end").tap();
    const menu = page.locator(`${READY} .xe-insert[data-end] [data-xe-menu]`);
    await expect(menu).toBeVisible();
    await expect(page.locator("#add-section")).toBeFocused();
    await expect.poll(async () => (await rect(menu)).bottom <= (await rect(bar(page))).top).toBe(true);
    await page.keyboard.press("Escape");

    // A "+" in a gap at the foot of the screen: its menu comes up into view, clear of the bar.
    const gapPlus = page.locator(`${READY} .xe-insert:not([data-end]) .xe-plus`).nth(2);
    await gapPlus.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - (window.innerHeight - 140)));
    await gapPlus.tap();
    const gapMenu = gapPlus.locator("xpath=ancestor::*[contains(@class,'xe-insert')][1]").locator("[data-xe-menu]");
    await expect(gapMenu).toBeVisible();
    await expect.poll(async () => (await rect(gapMenu)).bottom <= (await rect(bar(page))).top).toBe(true);
  });
});

/* ------------------------------------------------------------------------------------------------
 * The bar's actions, and Undo
 * ---------------------------------------------------------------------------------------------- */

test("a tap on a finding and typing at once, before its editor has loaded, keep every key; the editor takes over with the caret and it is saved", async ({ page }) => {
  const release = await holdRichEditor(page);
  const doc = full(sampleDoc("case-study"));
  const path = `sections.${doc.sections.findIndex((s) => s.kind === "findings")}.items.0`;
  const { id } = await openDoc(page, freshName("phonetype"), doc);
  const box = field(page, path);
  const findings = (await docNow(page)).sections.find((s) => s.kind === "findings") as Extract<Section, { kind: "findings" }>;
  const before = plain(findings.items[0]!);
  await box.locator(".xe-rest").scrollIntoViewIfNeeded();
  await box.locator(".xe-rest").tap();
  // The resting field is where the tap put the cursor (so a phone opens its keyboard), and takes the keys.
  await expect(box.locator(".xe-rest")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Tapped and typed.");
  await expect(box).not.toHaveAttribute("data-live");
  release();
  await expect(box).toHaveAttribute("data-live", "true");
  await expect(box.locator(".ProseMirror")).toBeFocused();
  await page.keyboard.type(" More.");
  const want = `${before} Tapped and typed. More.`;
  await expect(box.locator(".ProseMirror")).toHaveText(want);
  await waitSaved(page, id);
});

test.describe("the bar's actions", () => {
  test("Move up, Move down and Remove act on the section in focus; Undo in the top bar's menu puts a removed one back", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const order = await pageOrder(page);
    const at = order.indexOf("graph-2");
    await choose(page, "graph-2");

    await onBar(page, "Move Graph 2 up").tap();
    const up = [...order];
    [up[at - 1], up[at]] = [up[at]!, up[at - 1]!];
    await expect.poll(() => pageOrder(page)).toEqual(up);
    // It is the first graph now, so it is "Graph 1"; the bar follows it.
    await expect(bar(page)).toHaveAttribute("aria-label", "Graph 1: tools");
    await expect(onBar(page, "Undo: move graph 2")).toBeVisible();

    await onBar(page, "Move Graph 1 down").tap();
    await expect.poll(() => pageOrder(page)).toEqual(order);

    await onBar(page, "Remove Graph 2").tap();
    await expect.poll(() => pageOrder(page)).toEqual(order.filter((id) => id !== "graph-2"));
    await expect(onBar(page, "Undo: remove graph 2")).toBeVisible();

    // Undo in the top bar's menu (on a phone the row has no room for it).
    await page.getByRole("button", { name: "Menu" }).tap();
    await page.locator(`${READY} [data-topbar]`).getByRole("button", { name: "Undo: remove graph 2" }).tap();
    await expect.poll(() => pageOrder(page)).toEqual(order);
    await expect(onBar(page, /^Undo:/)).toHaveCount(0);
  });

  test("Remove on the bar, then Undo on the bar, puts graph 1 back where it was", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const order = await pageOrder(page);
    const before = await docNow(page);
    await choose(page, "graph-1");
    await onBar(page, "Remove Graph 1").tap();
    await expect.poll(() => pageOrder(page)).toEqual(order.filter((id) => id !== "graph-1"));
    await onBar(page, "Undo: remove graph 1").tap();
    await expect.poll(() => pageOrder(page)).toEqual(order);
    expect((await docNow(page)).sections).toEqual(before.sections);
    // Undone, the offer goes; it comes back only with the next move or remove.
    await expect(onBar(page, /^Undo:/)).toHaveCount(0);
    expect(await undoLabel(page)).toBeNull();
  });

  test("the Add a skill box has an Add button of 44px; it makes the typed words a skill", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    // The sample is at the most skills a page holds; take two off so there is room.
    await page.evaluate(() => window.__exhbtEditor!.patchDoc((d) => ({ ...d, skills: d.skills.slice(0, 3) })));
    const before = (await docNow(page)).skills;
    expect(before).toHaveLength(3);
    const add = page.locator(`${READY} [data-path="skills"] button`, { hasText: /^Add/ });
    await expect(add).toBeVisible();
    const box = await add.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.locator(`${READY} #skill-new`).fill("Stakeholder interviews");
    await add.tap();
    await expect.poll(async () => (await docNow(page)).skills).toEqual([...before, "Stakeholder interviews"]);
  });

  test("a tapped skill is named on the bar with Remove; the pills' own remove buttons are hidden", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const skills = (await docNow(page)).skills;
    expect(skills.length).toBeGreaterThan(1);
    const pill = field(page, "skills.0");
    await expect(pill.locator(".xe-pill-remove")).toBeHidden();
    await pill.tap();
    await expect(bar(page)).toHaveAttribute("aria-label", `${skills[0]}: tools`);
    await expect(bar(page).locator(".xe-bar-name")).toHaveText(skills[0]!);
    await onBar(page, `Remove ${skills[0]}`).tap();
    await expect.poll(async () => (await docNow(page)).skills).toEqual(skills.slice(1));
    // The skill is gone, so the bar is on the skills again.
    await expect(bar(page)).toHaveAttribute("aria-label", "Skills used: tools");
    await expect(onBar(page, /^Remove /)).toHaveCount(0);
  });

  test("after an Undo the focus is on the section's grip, not in its words, so the keyboard stays shut", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const order = await pageOrder(page);
    expect(order).toContain("quote-1");
    await choose(page, "quote-1");
    await onBar(page, /^Remove Quote/).tap();
    await expect.poll(() => pageOrder(page)).toEqual(order.filter((id) => id !== "quote-1"));
    await onBar(page, /^Undo: remove quote/).tap();
    await expect.poll(() => pageOrder(page)).toEqual(order);
    const focused = () =>
      page.evaluate(() => {
        const a = document.activeElement;
        return a?.hasAttribute("data-grip") ? `grip of ${a.closest("[data-section-id]")?.getAttribute("data-section-id")}` : `${a?.tagName.toLowerCase()} ${a?.getAttribute("data-path") ?? ""}`;
      });
    expect(await focused()).toBe("grip of quote-1");
  });

  test("the Undo offer lasts until the next change: typing takes it away", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    await choose(page, "quote-1");
    await onBar(page, "Move Quote up").tap();
    await expect(onBar(page, "Undo: move quote")).toBeVisible();
    await typeIn(page, "title", " again", { append: true });
    await expect(onBar(page, /^Undo:/)).toHaveCount(0);
    // Undo in the menu still has the move.
    expect(await undoLabel(page)).toBe("move quote");
  });

  test("a gallery's tile: Make lead image is on the bar and makes it the lead", async ({ page }) => {
    await openTiming(page, "gallery", { full: true });
    await waitLive(page);
    const order = await pageOrder(page);
    const tile = order.filter((id) => id.startsWith("image-"))[2]!;
    await choose(page, tile);
    await onBar(page, "Make lead image").tap();
    await expect.poll(async () => (await pageOrder(page)).find((id) => id.startsWith("image-"))).toBe(tile);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Formatting on the bar
 * ---------------------------------------------------------------------------------------------- */

test.describe("formatting on the bar", () => {
  test("in the context line the bar shows Highlight; it highlights the chosen words and the cursor stays in the field", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const gap = field(page, "gap");
    await gap.scrollIntoViewIfNeeded();
    await gap.tap();
    const pm = gap.locator(".ProseMirror");
    await expect(pm).toBeFocused();
    await expect(bar(page)).toHaveAttribute("aria-label", "Formatting");
    await expect(onBar(page, "Highlight")).toBeVisible();
    await expect(onBar(page, "Link")).toBeVisible();
    await expect(onBar(page, "Bold")).toHaveCount(0);
    // The page's own formatting buttons are not drawn on a phone.
    await expect(gap.locator(".xe-format")).toBeHidden();

    await chooseAll(page);
    await onBar(page, "Highlight").tap();
    await expect(pm).toBeFocused();
    await expect(onBar(page, "Highlight")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await docNow(page)).gap.every((r) => r.b === true)).toBe(true);
    await onBar(page, "Highlight").tap();
    await expect(pm).toBeFocused();
    await expect.poll(async () => (await docNow(page)).gap.some((r) => r.b)).toBe(false);

    // Done puts the part's own actions back, and lets the field go.
    await onBar(page, "Done").tap();
    await expect(pm).not.toBeFocused();
    await expect(bar(page)).toHaveAttribute("aria-label", "Context: tools");
  });

  test("in a finding: Bold, Italic, Link, the finding's own move and remove, and Done", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const findings = (await docNow(page)).sections.findIndex((s) => s.kind === "findings");
    const words = async () => ((await docNow(page)).sections[findings] as { items: RichText[] }).items.map(plain);
    const before = await words();
    const second = field(page, `sections.${findings}.items.1`);
    await second.scrollIntoViewIfNeeded();
    await second.tap();
    await expect(second.locator(".ProseMirror")).toBeFocused();
    for (const name of ["Bold", "Italic", "Link", "Move finding 2 up", "Move finding 2 down", "Remove finding 2", "Done"]) await expect(onBar(page, name)).toBeVisible();
    // A finding's own small controls are on the bar, not over its words.
    await expect(page.locator(`${READY} .xe-list-tools`).first()).toBeHidden();

    await onBar(page, "Move finding 2 up").tap();
    await expect.poll(words).toEqual([before[1], before[0], ...before.slice(2)]);
    // The cursor goes with it.
    await expect(field(page, `sections.${findings}.items.0`).locator(".ProseMirror")).toBeFocused();
    await expect(onBar(page, "Undo: move finding 2")).toBeVisible();

    await onBar(page, "Done").tap();
    await expect(bar(page)).toHaveAttribute("aria-label", "Findings: tools");
    await expect(grip(page, (await docNow(page)).sections[findings]!.id)).toBeFocused();
  });

  test("in a quote, a pull quote and a link's description: Bold and Italic are on the bar with no Link, and Bold marks the words chosen", async ({ page }) => {
    // Decision 0032: these three take bold and italic. None takes a link: a quote's neighbours (who said it, their role) are
    // plain, and a link's section is the link. The formatting is kept beside each one's plain words.
    const doc: ExhbtDoc = {
      schemaVersion: 2,
      format: "essay",
      title: "Did the law lead?",
      context: "Year 2 essay",
      skills: ["Argument"],
      gap: text("Courts follow more often than they lead."),
      flow: [{ step: "Read the cases" }, { step: "Set them in order" }, { step: "Weighed each one" }],
      sections: [
        { id: "flow", kind: "flow" },
        { id: "findings", kind: "findings", items: [text("The statute came first."), text("Opinion moved later.")] },
        { id: "pullquote-1", kind: "pullquote", text: "A court rarely leads." },
        { id: "quote-1", kind: "quote", text: "It read as a careful argument.", name: "", role: "" },
        { id: "link-1", kind: "link", href: "https://example.com/hansard", label: "Hansard, 3 March 1965", description: "The second reading" },
      ],
    };
    await openDoc(page, freshName("phyw"), doc);
    await waitLive(page);
    for (const [kind, key, runs] of [
      ["quote", "text", "textRuns"],
      ["pullquote", "text", "textRuns"],
      ["link", "description", "descriptionRuns"],
    ] as const) {
      const i = (await docNow(page)).sections.findIndex((s) => s.kind === kind);
      const f = field(page, `sections.${i}.${key}`);
      await f.scrollIntoViewIfNeeded();
      // At the start of its words. (A source's one line is 20px tall, and the 44px press of the "Web address" chip on the
      // rule under it reaches up over the middle of that line: as it did while the line was a plain field.)
      await f.tap({ position: { x: 24, y: 8 } });
      await expect(f.locator(".ProseMirror")).toBeFocused();
      for (const name of ["Bold", "Italic", "Done"]) await expect(onBar(page, name), kind).toBeVisible();
      await expect(onBar(page, "Link"), kind).toHaveCount(0);
      await chooseAll(page);
      // Under a finger no bar comes to the words: the system's own copy and paste bubble sits there, and the buttons are on this bar.
      await expect(page.locator(`${READY} .xe-selbar`), kind).toHaveCount(0);
      await onBar(page, "Bold").tap();
      await expect.poll(async () => ((await docNow(page)).sections[i] as unknown as Record<string, RichText | undefined>)[runs], kind).toMatchObject([{ b: true }]);
      await onBar(page, "Done").tap();
    }
    // The plain words are untouched: the formatting sits beside them.
    const after = await docNow(page);
    expect(after.sections.find((s) => s.kind === "quote")).toMatchObject({ text: "It read as a careful argument." });
    expect(after.sections.find((s) => s.kind === "link")).toMatchObject({ description: "The second reading" });
  });

  test("Link with words chosen opens the address prompt; a link is made only with an https address", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const findings = (await docNow(page)).sections.findIndex((s) => s.kind === "findings");
    const f = field(page, `sections.${findings}.items.2`);
    await f.scrollIntoViewIfNeeded();
    await f.tap();
    await expect(f.locator(".ProseMirror")).toBeFocused();
    await chooseAll(page);
    await onBar(page, "Link").tap();
    const address = f.getByLabel("Link address (starting https://)");
    await expect(address).toBeFocused();
    // The prompt is clear of the bar.
    expect((await rect(address)).bottom).toBeLessThanOrEqual((await rect(bar(page))).top);
    await address.fill("http://example.com/log");
    await f.getByRole("button", { name: "Add link" }).tap();
    await expect(f.getByRole("alert")).toHaveText("Links must start with https://.");
    expect(JSON.stringify((await docNow(page)).sections[findings])).not.toContain("href");
    await address.fill("https://example.com/log");
    await f.getByRole("button", { name: "Add link" }).tap();
    await expect.poll(async () => ((await docNow(page)).sections[findings] as { items: RichText[] }).items[2]!.every((r) => r.href === "https://example.com/log")).toBe(true);
    await expect(f.locator(".ProseMirror")).toBeFocused();
    await expect(onBar(page, "Remove link")).toBeVisible();
  });
});

/* ------------------------------------------------------------------------------------------------
 * The on-screen keyboard
 * ---------------------------------------------------------------------------------------------- */

test("with the keyboard up the bar sits on it, and the line being typed stays clear of the bar", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  const findings = (await docNow(page)).sections.findIndex((s) => s.kind === "findings");
  const f = field(page, `sections.${findings}.items.3`);
  await f.scrollIntoViewIfNeeded();
  await f.tap();
  const pm = f.locator(".ProseMirror");
  await expect(pm).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  // The field at the foot of what can be seen, then a keyboard 330px tall: a smaller visual viewport, as a phone's keyboard makes it.
  await page.evaluate(() => {
    const el = document.activeElement!;
    window.scrollBy(0, el.getBoundingClientRect().bottom - window.innerHeight + 90);
  });
  const keyboard = 330;
  await page.evaluate((k) => {
    const vv = window.visualViewport!;
    const h = vv.height;
    Object.defineProperty(vv, "height", { configurable: true, get: () => h - k });
    vv.dispatchEvent(new Event("resize"));
  }, keyboard);
  const viewport = page.viewportSize()!;
  await expect.poll(async () => Math.round((await rect(bar(page))).bottom)).toBe(viewport.height - keyboard);
  await expect(bar(page)).toHaveAttribute("data-keyboard", "");
  // The caret is above the bar.
  const caret = () => page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().bottom);
  await expect.poll(async () => (await caret()) <= (await rect(bar(page))).top).toBe(true);
  // Typing on: the line stays clear of it.
  await page.keyboard.type(" and the line keeps going until it wraps onto a new line or two below the old one", { delay: 5 });
  await expect.poll(async () => (await caret()) <= (await rect(bar(page))).top).toBe(true);
  // The keyboard goes down: the bar goes back to the foot.
  await page.evaluate(() => {
    const vv = window.visualViewport!;
    delete (vv as unknown as Record<string, unknown>).height;
    vv.dispatchEvent(new Event("resize"));
  });
  await expect.poll(async () => Math.round((await rect(bar(page))).bottom)).toBe(viewport.height);
  await expect(bar(page)).not.toHaveAttribute("data-keyboard");
});

/* ------------------------------------------------------------------------------------------------
 * Reorder sections
 * ---------------------------------------------------------------------------------------------- */

test.describe("reorder sections", () => {
  test("the sheet's live region is emptied and set again for every message, so words said twice are announced twice", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    await onBar(page, "Reorder sections").tap();
    await expect(sheet(page)).toBeVisible();
    const region = sheet(page).locator("[aria-live][data-said]");
    await expect(region).toHaveCount(1);
    // What the region holds, each time it changes: an emptied region is not recorded, a set one is.
    await region.evaluate((el) => {
      const seen: string[] = [];
      (window as unknown as { __said: string[] }).__said = seen;
      new MutationObserver(() => el.textContent && seen.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
    });
    const said = () => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
    const order = await pageOrder(page);
    const q = order.indexOf("quote-1");
    // Up, down, up: the third message is the first one again. Each is its own change of the region's words.
    const up = `Quote moved up, to place ${q} of ${order.length}.`;
    const down = `Quote moved down, to place ${q + 1} of ${order.length}.`;
    await sheet(page).getByRole("button", { name: "Move Quote up" }).tap();
    await expect(region).toHaveText(up);
    await sheet(page).getByRole("button", { name: "Move Quote down" }).tap();
    await expect(region).toHaveText(down);
    await sheet(page).getByRole("button", { name: "Move Quote up" }).tap();
    await expect(region).toHaveText(up);
    expect(await said()).toEqual([up, down, up]);
  });

  test("Reorder opens the sheet; a row moved by its buttons and a row dragged after a short press move the page; Done returns to that section", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const order = await pageOrder(page);
    await onBar(page, "Reorder sections").tap();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole("heading", { name: "Reorder sections" })).toBeVisible();
    // One row per page item, in order, the flowchart included, all one height.
    await expect(sheet(page).locator("[data-row]")).toHaveCount(order.length);
    expect(await sheet(page).locator("[data-row]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-row")))).toEqual(order);
    const heights = await sheet(page).locator("[data-row]").evaluateAll((rows) => [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height)))]);
    expect(heights).toHaveLength(1);

    // By its buttons: the quote up one, read out in the sheet, the focus kept on the button.
    const q = order.indexOf("quote-1");
    await sheet(page).getByRole("button", { name: "Move Quote up" }).tap();
    const one = [...order];
    [one[q - 1], one[q]] = [one[q]!, one[q - 1]!];
    await expect.poll(() => pageOrder(page)).toEqual(one);
    await expect(sheet(page).getByRole("button", { name: "Move Quote up" })).toBeFocused();
    await expect(sheet(page).locator("[aria-live]", { hasText: `Quote moved up, to place ${q} of ${order.length}.` })).toHaveCount(1);
    expect(await undoLabel(page)).toBe("move quote");

    // Dragged: the link, after a short press, up two rows.
    const touch = await finger(page);
    const from = await middle(sheet(page).locator('[data-row="link-1"] .xe-reorder-grip'));
    const row = (await sheet(page).locator('[data-row="link-1"]').boundingBox())!.height + 8;
    await touch.down(from.x, from.y);
    await page.waitForTimeout(260);
    await touch.move(from.x, from.y - 2);
    await expect(sheet(page).locator('[data-row="link-1"][data-dragging]')).toHaveCount(1);
    await touch.slide(from, { x: from.x, y: from.y - row * 2 });
    await page.waitForTimeout(250);
    await touch.up();
    const l = one.indexOf("link-1");
    const two = one.filter((id) => id !== "link-1");
    two.splice(l - 2, 0, "link-1");
    await expect.poll(() => pageOrder(page)).toEqual(two);
    expect(await undoLabel(page)).toBe("move link");
    await expect(sheet(page).locator("[aria-live]", { hasText: `Link dropped in place ${l - 1} of ${order.length}.` })).toHaveCount(1);

    // Done: the page at the section last moved, its grip focused, the bar on it.
    await sheet(page).getByRole("button", { name: "Done" }).tap();
    await expect(sheet(page)).toBeHidden();
    await expect(grip(page, "link-1")).toBeFocused();
    const r = await rect(frame(page, "link-1"));
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.bottom).toBeLessThanOrEqual((await rect(bar(page))).top);
    await expect(bar(page)).toHaveAttribute("aria-label", "Link: tools");
    await expect(onBar(page, "Undo: move link")).toBeVisible();
  });

  test("from the keyboard: the grip picks a row up, the arrows move it, each step is read out", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    const order = await pageOrder(page);
    await onBar(page, "Reorder sections").tap();
    const g = sheet(page).locator('[data-row="flow"] .xe-reorder-grip');
    await g.focus();
    await page.keyboard.press("Space");
    await expect(sheet(page).locator("[aria-live]", { hasText: /^Picked up flowchart, place 1 of \d+\.$/ })).toHaveCount(1);
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowDown");
    await expect(sheet(page).locator("[aria-live]", { hasText: "Flowchart would go to place 2" })).toHaveCount(1);
    await page.keyboard.press("Space");
    await expect.poll(() => pageOrder(page)).toEqual([order[1], "flow", ...order.slice(2)]);
    expect(await undoLabel(page)).toBe("move flowchart");
  });
});

/* ------------------------------------------------------------------------------------------------
 * Touch on the page
 * ---------------------------------------------------------------------------------------------- */

test("a swipe on a section's words scrolls and moves nothing; a 260ms press on a grip picks it up and the bar steps aside; the flowchart is carried with a line", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  const touch = await finger(page);
  const order = await pageOrder(page);

  const words = frame(page, "findings");
  await words.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const w = (await words.boundingBox())!;
  const y0 = await scrollY(page);
  await touch.down(w.x + 80, w.y + 60);
  await touch.slide({ x: w.x + 80, y: w.y + 60 }, { x: w.x + 80, y: w.y - 200 });
  await touch.up();
  // Touches made in the page (WebKit: finger, page-editor.ts) can't scroll it, so the scroll is checked only under real ones.
  if (touch.native) await expect.poll(() => scrollY(page)).toBeGreaterThan(y0 + 120);
  expect(await pageOrder(page)).toEqual(order);
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);

  // The flowchart's grip, held: picked up, carried with a line; the bar steps aside until the drop.
  await grip(page, "flow").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const at = await middle(grip(page, "flow"));
  await touch.down(at.x, at.y);
  await page.waitForTimeout(260);
  await touch.move(at.x, at.y + 2);
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveAttribute("data-xe-drag", "pointer");
  expect(await page.evaluate(() => window.__exhbtDrag!.state()!.style)).toBe("line");
  await expect(bar(page)).toBeHidden();
  await touch.up();
  await expect(page.locator(`${READY} [data-xe-drag]`)).toHaveCount(0);
  await expect(bar(page)).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------
 * At 390px: no sideways scroll, and every control takes a thumb
 * ---------------------------------------------------------------------------------------------- */

test("Review and publish: two lines at most, inside its pill", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  const fit = await page.getByRole("button", { name: "Review and publish" }).evaluate((b) => {
    const r = b.getBoundingClientRect();
    const range = document.createRange();
    const lines: DOMRect[] = [];
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent?.trim()) continue;
      range.selectNodeContents(t);
      lines.push(...[...range.getClientRects()].filter((q) => q.width > 0));
    }
    return { inside: lines.length > 0 && lines.every((q) => q.left >= r.left - 0.5 && q.right <= r.right + 0.5 && q.top >= r.top - 0.5 && q.bottom <= r.bottom + 0.5), lines: new Set(lines.map((q) => Math.round(q.top))).size };
  });
  expect(fit.inside).toBe(true);
  expect(fit.lines).toBeLessThanOrEqual(2);
});

for (const f of offered()) {
  test(`${FORMAT_RULES[f].name.toLowerCase()}: a flowchart box's chips, on its top corners, clear its words by 4px and more and take a 44px press; no + covers them or words`, async ({ page }) => {
    await openTiming(page, f, { full: true });
    await waitLive(page);
    // Design round 2, item 5: Remove touched the first letter of the box's words.
    expect(await flowChipsNearWords(page, 4)).toEqual([]);
    expect(await smallPresses(page, `${READY} .xp-flow-box .xe-flow-chip`)).toEqual([]);
    // The "+" above a case study's first box moves along, clear of that box's Remove and its press.
    expect(await plusClashes(page)).toEqual([]);
    expect(await smallPresses(page, `${READY} .xe-insert .xe-plus`)).toEqual([]);
  });
}

test("a Build exhbt with three links: a tap on each button's words puts the cursor in that link, and each Web address opens its own link's address", async ({ page }) => {
  // Its buttons wrap on a phone: one to a line on an iPhone, the first alone and two side by side on a Pixel 7. Under its line
  // the first link's Web address lay over the top of the second button, and took a tap on the middle of its words.
  const build = sampleDoc("build");
  const third: Section = { id: "link-3", kind: "link", href: "https://example.com/shift-swap-docs", label: "Read the docs", description: "Setup and the API" };
  const doc = full({ ...build, sections: [...build.sections, third] });
  await openDoc(page, freshName("phonelinks"), doc);
  await waitLive(page);
  const links = (await docNow(page)).sections.flatMap((s, n) => (s.kind === "link" ? [{ id: s.id, n }] : []));
  expect(links).toHaveLength(3);
  // The buttons do wrap here (the test is about a row of more than one line).
  const tops = await Promise.all(links.map(async ({ id }) => Math.round((await rect(frame(page, id))).top + (await scrollY(page)))));
  expect(new Set(tops).size).toBeGreaterThan(1);
  /** A finger's tap at the middle of `l`, where it is drawn now. */
  const tapMiddle = async (l: Locator) => {
    await l.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const r = await rect(l);
    await page.touchscreen.tap(r.left + r.width / 2, r.top + r.height / 2);
  };
  for (const { id, n } of links) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await tapMiddle(field(page, `sections.${n}.label`));
    await expect.poll(() => focusedPath(page), `a tap on ${id}'s words`).toBe(`sections.${n}.label`);
  }
  for (const { id, n } of links) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await tapMiddle(frame(page, id).locator(".xe-fig-corner"));
    const pop = frame(page, id).locator("[popover], dialog").first();
    await expect(pop, `${id}'s Web address`).toBeVisible();
    await expect(pop.locator("input")).toBeFocused();
    await expect(pop.locator("input")).toHaveAttribute("data-path", `sections.${n}.href`);
    // Only its own is open.
    const open = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-editor="page"] .xe-fig-pop-link')].filter((p) => (p instanceof HTMLDialogElement ? p.open : p.matches(":popover-open"))).length);
    expect(open).toBe(1);
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
  }
});

test("the bar is one Tab stop: the arrows, Home and End move along it, and the stop goes back to its first button when the focus leaves", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  await choose(page, "quote-1");
  const stops = () => bar(page).locator("button").evaluateAll((bs) => bs.filter((b) => b.tabIndex === 0 && b.getClientRects().length > 0).map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim()));
  expect(await stops()).toHaveLength(1);
  // Drawn in the toolbars' order (design round 2, item 2): Remove after the name, the moves and Reorder at the right end.
  const drawn = await bar(page)
    .locator(".xe-bar-row button")
    .evaluateAll((bs) => bs.filter((b) => b.getClientRects().length > 0).sort((p, q) => p.getBoundingClientRect().left - q.getBoundingClientRect().left).map((b) => b.getAttribute("aria-label")));
  expect(drawn).toEqual(["Remove Quote", "Move Quote up", "Move Quote down", "Reorder sections"]);
  // The stop is the first in the reading order, Move up; the arrows go as drawn.
  const first = bar(page).locator("button").first();
  await expect(first).toHaveAccessibleName("Move Quote up");
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(onBar(page, "Move Quote down")).toBeFocused();
  await page.keyboard.press("End");
  await expect(onBar(page, "Reorder sections")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(onBar(page, "Remove Quote")).toBeFocused();
  await page.keyboard.press("End");
  expect(await stops()).toEqual(["Reorder sections"]);
  await grip(page, "quote-1").focus();
  expect(await stops()).toHaveLength(1);
  expect((await stops())[0]).toBe(await first.getAttribute("aria-label"));
});

test("an open + menu lies over every chip, grip and toolbar: before the flowchart, a tap anywhere on it is the menu's", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  // The + before the flowchart (the first gap), whose menu opens down over the boxes' always-shown chips and the "+" on each arrow.
  const at = (await pageOrder(page)).indexOf("flow");
  const plus = page.locator(`${READY} .xe-insert[data-at="${at}"] .xe-plus`);
  await plus.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await plus.tap();
  const menu = page.locator(`${READY} .xe-insert[data-at="${at}"] [data-xe-menu]`);
  await expect(menu).toBeVisible();
  await page.waitForTimeout(300);
  const lost = await menu.evaluate((m) => {
    const r = m.getBoundingClientRect();
    // The app's own bars, at the top and foot of the screen, rightly lie over the page and its menus.
    const top = document.querySelector('[data-editor="page"] [data-topbar]')?.getBoundingClientRect().bottom ?? 0;
    const foot = document.querySelector('[data-editor="page"] .xe-phonebar')?.getBoundingClientRect().top ?? window.innerHeight;
    const points: [number, number, string][] = [];
    // Along its edges, 3px in, every 12px (clear of the rounded corners, which a tap doesn't hit).
    const round = parseFloat(getComputedStyle(m).borderTopLeftRadius) || 0;
    for (let x = r.left + round + 3; x <= r.right - round - 3; x += 12) points.push([x, r.top + 3, "top edge"], [x, r.bottom - 3, "foot"]);
    for (let y = r.top + round + 3; y <= r.bottom - round - 3; y += 12) points.push([r.left + 3, y, "left edge"], [r.right - 3, y, "right edge"]);
    // Across each item, through its middle.
    for (const item of m.querySelectorAll(".xe-plus-item")) {
      const b = item.getBoundingClientRect();
      for (let x = b.left + 2; x <= b.right - 2; x += 8) points.push([x, b.top + b.height / 2, item.textContent!.trim().slice(0, 20)]);
    }
    const seen = points.filter(([x, y]) => y > top && y < foot && x >= 0 && x < window.innerWidth);
    return {
      tried: seen.length,
      lost: seen.flatMap(([x, y, where]) => {
        const hit = document.elementFromPoint(x, y);
        return hit && m.contains(hit) ? [] : [`${where} at ${Math.round(x)},${Math.round(y)}: ${hit?.getAttribute("aria-label") ?? hit?.className ?? "nothing"}`];
      }),
    };
  });
  expect(lost.tried).toBeGreaterThan(60);
  expect(lost.lost).toEqual([]);
});

test.describe("at 390px wide", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** Controls whose press is smaller than 44px today, each owned elsewhere: none. (A skill's remove is on the bar on a phone.) */
  const KNOWN: string[] = [];

  for (const f of offered()) {
    test(`${FORMAT_RULES[f].name.toLowerCase()}'s sample: nothing scrolls sideways, and every control takes a 44px press`, async ({ page }) => {
      await openTiming(page, f, { full: true });
      await waitLive(page);
      // With the bar on a section, and with it formatting.
      const first = (await pageOrder(page))[0]!;
      await choose(page, first);
      const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await sideways()).toBeLessThanOrEqual(0);

      const small = await page.evaluate((known) => {
        const shown = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0 && !el.closest("[inert], [hidden], dialog:not([open])");
        const controls = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] :is(button, a[href], [role="button"], input[type="checkbox"])')].filter((el) => shown(el) && !el.closest("[contenteditable]") && !known.some((k) => el.matches(k)));
        const bad: string[] = [];
        const mine = (el: Element, x: number, y: number) => {
          const hit = document.elementFromPoint(x, y);
          return Boolean(hit && (hit === el || el.contains(hit)));
        };
        for (const el of controls) {
          // The press is what the finger hits, which may be larger than the control's box: from its middle,
          // how far each way the control (or what it holds) is what a finger lands on, with nothing over it.
          el.scrollIntoView({ block: "center", inline: "center" });
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const reach = (dx: number, dy: number) => {
            let s = 0;
            while (s < 40 && mine(el, cx + dx * (s + 1), cy + dy * (s + 1))) s++;
            return s;
          };
          const w = reach(-1, 0) + reach(1, 0) + 1;
          const h = reach(0, -1) + reach(0, 1) + 1;
          // Hit testing is in whole pixels and the middle can fall between two, so a 44px press measures 42 or 43.
          if (!mine(el, cx, cy) || w < 42 || h < 42) bad.push(`${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? el.tagName} (${Math.round(r.width)}x${Math.round(r.height)}, takes ${w}x${h})`);
        }
        return bad;
      }, KNOWN);
      expect(small).toEqual([]);
      // Typing in a finding (the bar formatting, with the finding's own controls): still nothing sideways, and the row is one line.
      const findings = (await docNow(page)).sections.findIndex((s) => s.kind === "findings");
      const fi = field(page, `sections.${findings}.items.0`);
      await fi.scrollIntoViewIfNeeded();
      await fi.tap();
      await expect(bar(page)).toHaveAttribute("aria-label", "Formatting");
      await expect(onBar(page, "Remove finding 1")).toBeVisible();
      expect(await sideways()).toBeLessThanOrEqual(0);
      expect((await bar(page).locator(".xe-bar-row").boundingBox())!.height).toBeLessThan(50);
    });
  }
});

/* ------------------------------------------------------------------------------------------------
 * Box for box, the status line, axe
 * ---------------------------------------------------------------------------------------------- */

test.describe("box for box on a Pixel 7", () => {
  for (const f of offered()) {
    test(`a full ${FORMAT_RULES[f].name.toLowerCase()}: the editing page is the visitor's but for the two edit-only fields; the bar and the grips add no box`, async ({ page }) => {
      // The real edit page, signed in, on the layout's sample with every optional part given words.
      await openDoc(page, freshName("phonebox"), full(sampleDoc(f)));
      await waitLive(page);
      // The bar is up, on a section.
      await choose(page, (await pageOrder(page))[1]!);
      expect(await page.locator(`${READY} article .xe-phonebar`).count()).toBe(0);
      expect(await page.locator(`${READY} article .xe-tools`).evaluateAll((els) => els.every((e) => getComputedStyle(e).position === "absolute"))).toBe(true);
      await allowEditOnly(page, "always");
      await settle(page);
      const editing = await boxes(page);
      await seeAsVisitor(page, true);
      await settle(page);
      expect(differences(await boxes(page), editing)).toEqual([]);
      // "See as a visitor" has nothing to edit: no bar.
      await expect(bar(page)).toHaveCount(0);
    });
  }
});

test("three pictures picked at once: the status line sits just above the bar and the two never overlap", async ({ page }) => {
  const { id } = await openDoc(page, freshName("phonethree"), { ...sampleDoc("gallery"), sections: sampleDoc("gallery").sections.filter((s) => s.kind !== "image") });
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/files/upload-url", async (route) => {
    if ((route.request().postDataJSON() as { name: string }).name === "a.png") await held;
    await route.continue();
  });
  await expect(bar(page)).toBeVisible();
  await page.locator(`${READY} input[aria-label='Choose an image']`).setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: png(30, 10) },
    { name: "b.png", mimeType: "image/png", buffer: png(40, 10) },
    { name: "c.png", mimeType: "image/png", buffer: png(50, 10) },
  ]);
  const status = page.locator(`${READY} .xe-status [role=status]`);
  await expect(status).toHaveText(/^Uploading [123] of 3$/);
  const clear = async () => {
    const s = await rect(status);
    const b = await rect(bar(page));
    return s.bottom <= b.top && b.top - s.bottom <= 12;
  };
  await expect.poll(clear).toBe(true);
  release();
  await expect(status).toHaveText("3 images added. Each one needs a description for people who can't see it.");
  await expect.poll(clear).toBe(true);
  await waitSaved(page, id);
});

test("axe: on the page with the bar on a section, with the bar formatting, and with the reorder sheet open", async ({ page }) => {
  await openTiming(page, "case-study", { full: true });
  await waitLive(page);
  await choose(page, "graph-1");
  expect(await scan(page), "the bar on a section").toEqual([]);
  await typeIn(page, "gap", " More words.", { append: true });
  await expect(bar(page)).toHaveAttribute("aria-label", "Formatting");
  expect(await scan(page), "the bar formatting").toEqual([]);
  await onBar(page, "Done").tap();
  await onBar(page, "Reorder sections").tap();
  await expect(sheet(page)).toBeVisible();
  expect(await scan(page), "the reorder sheet").toEqual([]);
});

test("a drafted part: the bar offers its More actions, and the menu opens above the bar within the screen", async ({ page }) => {
  await page.goto(`/auth/dev?email=${freshName("phonedraft")}@example.com&next=${encodeURIComponent(DRAFT_WITH_AI)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft it from your files" })).toBeVisible();
  const res = await page.request.post("/api/exhbts/draft", {
    data: { text: "Final-year project on lunch queues. I timed the queue for two weeks, added a second till, and timed it again. Waits fell from 11 to 4 minutes." },
  });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/exhbts/${id}/edit`);
  await expect(page.locator(READY)).toBeAttached();
  await waitLive(page);

  await field(page, "title").tap();
  const more = onBar(page, /^More actions for /);
  await expect(more).toBeVisible();
  await more.tap();
  const menu = bar(page).getByRole("button", { name: "Rewrite this block" });
  await expect(menu).toBeVisible();
  // Above its button, within the screen.
  const m = await rect(menu);
  expect(m.top).toBeGreaterThanOrEqual(0);
  expect(m.bottom).toBeLessThanOrEqual((await rect(more)).top);

  // The findings section's More actions too: the menu above the bar, then the rewrite form in a line of its own above the bar's row, all in the screen and every control 44px.
  const findings = (await docNow(page)).sections.find((s) => s.kind === "findings")!.id;
  await choose(page, findings);
  await onBar(page, "More actions for Findings").tap();
  const item = bar(page).getByRole("button", { name: "Rewrite this block" });
  await expect(item).toBeVisible();
  const it = await rect(item);
  expect(it.left).toBeGreaterThanOrEqual(0);
  expect(it.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(Math.round(it.height)).toBeGreaterThanOrEqual(44);
  await item.tap();
  const form = bar(page).locator("form");
  await expect(form).toBeVisible();
  const fr = await rect(form);
  const row = await rect(onBar(page, "More actions for Findings"));
  expect(fr.top).toBeGreaterThanOrEqual(0);
  expect(fr.bottom).toBeLessThanOrEqual(row.top);
  expect(fr.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  const sizes = await form.locator("button, input").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(sizes.every((h) => h >= 44)).toBe(true);
  await bar(page).getByRole("button", { name: "Cancel" }).tap();
  await expect(form).toHaveCount(0);
});

// Escape closes a rewrite form on the bar too, with the focus on nothing as with it in the form, and gives the focus back to More
// actions. The bar lays out More actions' parts in its own row (display: contents), so their wrapper has no box of its own.
test("a drafted part's rewrite form on the bar closes with Escape, and the focus goes back to More actions", async ({ page }) => {
  await page.goto(`/auth/dev?email=${freshName("phoneescape")}@example.com&next=${encodeURIComponent(DRAFT_WITH_AI)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Draft it from your files" })).toBeVisible();
  const res = await page.request.post("/api/exhbts/draft", { data: { text: "Final-year project on lunch queues. I timed the queue for two weeks, added a second till, and timed it again. Waits fell from 11 to 4 minutes." } });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/exhbts/${id}/edit`);
  await expect(page.locator(READY)).toBeAttached();
  await waitLive(page);
  await choose(page, (await docNow(page)).sections.find((s) => s.kind === "findings")!.id);
  const more = onBar(page, "More actions for Findings");
  const form = bar(page).locator("form");
  for (const where of ["on nothing", "in the form"]) {
    await more.tap();
    await bar(page).getByRole("button", { name: "Rewrite this block" }).tap();
    await expect(form).toBeVisible();
    if (where === "on nothing") await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    else await form.getByRole("textbox").focus();
    await page.keyboard.press("Escape");
    await expect(form, `the focus ${where}`).toHaveCount(0);
    await expect(more, `the focus ${where}`).toBeFocused();
  }
});

/* ------------------------------------------------------------------------------------------------
 * At 390px: J's figures, pictures and links; the figures sheet; the top bar's menu
 * ---------------------------------------------------------------------------------------------- */

test.describe("figures, pictures and links at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** Every visible control in `root` under 44px tall, by name. */
  const small = (root: Locator) =>
    root.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('button, select, input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), label:has(input[type="radio"]), label:has(input[type="checkbox"])')]
        .filter((c) => c.getClientRects().length > 0 && !c.closest(".sr-only"))
        .map((c) => ({ name: c.getAttribute("aria-label") ?? c.textContent?.trim().slice(0, 30) ?? c.tagName, h: c.getBoundingClientRect().height }))
        .filter((c) => Math.round(c.h) < 44)
        .map((c) => `${c.name} (${Math.round(c.h)}px)`),
    );
  const inScreen = async (page: Page, l: Locator) => {
    const r = await rect(l);
    const w = page.viewportSize()!.width;
    return r.left >= -0.5 && r.right <= w + 0.5 && r.top >= -0.5;
  };
  const overlap = (a: DOMRect, b: DOMRect) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;

  test("the chips clear the grips and the +; a picked figure's label clears its grip and opens its strip; Web address opens in the screen; the figures sheet fills the screen with 44px controls", async ({ page }) => {
    const picked: Section = { id: "image-1", kind: "image", fileId: "x", alt: "", caption: text("Missed appointments by reminder time"), w: 1200, h: 700, picked: { from: "report.pdf", page: 3, box: { x: 0, y: 0, w: 1, h: 0.5 }, shareOk: false } };
    const doc = full({ ...sampleDoc("case-study"), sections: [...sampleDoc("case-study").sections, picked] } as ExhbtDoc);
    await openDoc(page, freshName("phonefig"), doc);
    await waitLive(page);

    // No chip ("Edit figures", "Web address") lies over a grip, a "+" or a flowchart box's tools.
    const clashes = await page.evaluate(() => {
      const others = [...document.querySelectorAll('[data-editor="page"] :is([data-grip], .xe-plus, .xe-flow-chip)')].map((o) => ({ name: o.getAttribute("aria-label"), r: o.getBoundingClientRect() }));
      return [...document.querySelectorAll('[data-editor="page"] .xe-fig-corner')].flatMap((c) => {
        const r = c.getBoundingClientRect();
        return others.filter((o) => o.r.width && r.right > o.r.left && r.left < o.r.right && r.bottom > o.r.top && r.top < o.r.bottom).map((o) => `${c.getAttribute("aria-label")} over ${o.name}`);
      });
    });
    expect(clashes).toEqual([]);

    // The picked figure: its label clears the picture's grip; a tap on its source opens the strip, in the screen, and ticks nothing.
    const fig = frame(page, "image-1");
    await fig.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const label = fig.locator(".xe-fig-picked");
    expect(overlap(await rect(label), await rect(grip(page, "image-1")))).toBe(false);
    await fig.locator(".xe-fig-picked-open").tap();
    const strip = fig.locator("[popover]").first();
    await expect(strip).toBeVisible();
    expect(await inScreen(page, strip)).toBe(true);
    expect(((await docNow(page)).sections.find((s) => s.id === "image-1") as { picked: { shareOk: boolean } }).picked.shareOk).toBe(false);
    await page.keyboard.press("Escape");
    await expect(strip).toBeHidden();
    // Its description field is there, under the picture.
    await expect(fig.locator('[data-edit-only="image-description"]')).toBeVisible();

    // A link's Web address: its popover in the screen, above the bar, the cursor in its field.
    const link = frame(page, "link-1");
    await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await link.locator(".xe-fig-corner").tap();
    const pop = link.locator("[popover]").first();
    await expect(pop).toBeVisible();
    expect(await inScreen(page, pop)).toBe(true);
    expect((await rect(pop)).bottom).toBeLessThanOrEqual((await rect(bar(page))).top);
    await expect(pop.locator("input")).toBeFocused();
    await page.keyboard.press("Escape");

    // The figures sheet: the whole screen, nothing sideways, the close within a thumb's reach, every control 44px.
    const graph = frame(page, "graph-1");
    await graph.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await graph.locator(".xe-fig-corner").tap();
    const chart = page.locator(`${READY} dialog[data-sheet="chart"]`);
    await expect(chart).toBeVisible();
    expect(await rect(chart)).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
    expect(await chart.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0);
    const close = await rect(chart.getByRole("button", { name: "Close" }));
    expect([Math.round(close.width), Math.round(close.height)]).toEqual([44, 44]);
    expect(await small(chart)).toEqual([]);
    expect(await scan(page)).toEqual([]);
  });

  test("Take a figure from my report: the sheet fills the screen, its page picker and crop take a thumb", async ({ page }) => {
    // Drafts from a report (its pick made to fail, so nothing is picked) and draws its pages: several routes compiled for the first time in development.
    test.setTimeout(180_000);
    await page.route("**/api/exhbts/figure-pick", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "We couldn't pick a figure just now." }) }));
    const username = freshName("phonetake");
    await page.goto(`/dev/portfolio?username=${username}&plan=premium&count=0`);
    await page.goto(`/auth/dev?email=${username}@example.com&next=${encodeURIComponent(DRAFT_WITH_AI)}`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.locator("#files").setInputFiles("e2e/fixtures/report-with-chart.pdf");
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit/, { timeout: 120_000 });
    await expect(page.locator(READY)).toBeAttached();

    await onBar(page, "Add a section at the end").tap();
    const item = page.locator(`${READY} [data-xe-menu] [data-block="figure"]`);
    await expect(item).toBeEnabled();
    await item.tap();
    const take = page.locator(`${READY} dialog[data-sheet="figure"]`);
    await expect(take).toBeVisible();
    expect(await rect(take)).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
    const picker = take.getByTestId("page-picker");
    await expect(picker.getByRole("button", { name: /^Page \d/ })).toHaveCount(4);
    expect(await take.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0);
    expect(await small(take)).toEqual([]);
    await picker.getByRole("button", { name: "Page 3", exact: true }).tap();
    const cropper = take.getByTestId("cropper");
    await expect(cropper.getByRole("img", { name: "Page 3 of report-with-chart.pdf" })).toBeVisible({ timeout: 60_000 });
    expect(await take.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0);
    expect(await small(take)).toEqual([]);
    await expect(take.getByRole("button", { name: "Close" })).toBeVisible();
  });

  test("the top bar's menu: Delete this exhbt, and its question, take a 44px press", async ({ page }) => {
    await openTiming(page, "case-study", { full: true });
    await waitLive(page);
    await page.getByRole("button", { name: "Menu" }).tap();
    const menu = page.locator(`${READY} .xe-menu-items`);
    await expect(menu.getByRole("button", { name: "Delete this exhbt" })).toBeVisible();
    expect(await small(menu)).toEqual([]);
    await menu.getByRole("button", { name: "Delete this exhbt" }).tap();
    await expect(menu.getByRole("button", { name: "Yes, delete" })).toBeVisible();
    expect(await small(menu)).toEqual([]);
    await menu.getByRole("button", { name: "Cancel" }).tap();
  });
});
