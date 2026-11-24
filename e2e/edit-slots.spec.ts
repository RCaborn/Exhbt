import { expect, test, type Page } from "@playwright/test";
import type { ExhbtDoc } from "../lib/exhbt/blocks";
import { FORMAT_COPY, FORMAT_RULES, formatOf } from "../lib/exhbt/formats";
import { flowShown, pageItems, rowsFor, type Cell, type Row } from "../lib/exhbt/layouts";
import { fullDoc, GALLERY_IMAGES, galleryDoc, researchDoc } from "../lib/exhbt/sample";
import { beforeAfterFixture, buildFixture, essayFixture, eventFixture } from "../app/dev/edit-slots/layouts";
import { arrangedCase, arrangedGallery, arrangedResearch, galleryFlowOff, galleryOverCap, researchNoAim } from "../app/dev/edit-slots/orders";

/*
 * The page's editing slots (decision 0026, "One page, one renderer"), through the slot harness
 * (app/dev/edit-slots), whose stand-in adapter marks every slot and adds no box:
 *  - every field path in 0026's table that the layout has is there exactly once, with its name;
 *  - every page item has one item slot, every row a "+" before it and the page one at its end, and
 *    the title, the context line and the skills each have their corner tools;
 *  - box for box, at 1440 and 412 wide: on a page with every optional part filled (?full=1), the
 *    editing page is the visitor's page to half a pixel but for the two edit-only fields 0026 keeps in
 *    the flow (each image's description, the "Add a skill" box), and each of those sits where 0026
 *    says and adds only its own height; on the sample as it is, every difference is a part on 0026's
 *    list of what is in the flow in the editor only, named, and nothing else.
 *
 * All seven layouts: the case study, the gallery and research by their samples, the four of decision
 * 0028 by the harness's own fixtures (app/dev/edit-slots/layouts.ts); and pages out of their usual
 * order, as the new editor will write them (app/dev/edit-slots/orders.ts).
 */

const SAMPLES: Record<string, ExhbtDoc> = {
  "case-study": fullDoc,
  gallery: galleryDoc(GALLERY_IMAGES.map((_, i) => `gallery-${i + 1}`)),
  research: researchDoc("research-1"),
  // The four layouts of decision 0028: the harness's own fixtures until their samples exist.
  build: buildFixture,
  essay: essayFixture,
  "before-after": beforeAfterFixture,
  event: eventFixture,
  // Pages out of their usual order, as the new editor will write them, and a gallery over its cap.
  "arranged-case": arrangedCase,
  "arranged-gallery": arrangedGallery,
  "gallery-flow-off": galleryFlowOff,
  "gallery-over-cap": galleryOverCap,
  "arranged-research": arrangedResearch,
  "research-no-aim": researchNoAim,
};

type Field = { path: string; label: string; id?: string };

/** The fields of 0026's table that this doc's page has, with their names and fixed ids. */
function fieldsOf(doc: ExhbtDoc): Field[] {
  const copy = FORMAT_COPY[formatOf(doc)];
  const out: Field[] = [
    { path: "title", label: copy.title, id: "title" },
    { path: "gap", label: copy.gap },
    { path: "context", label: "What it is", id: "context" },
    { path: "whereWhen", label: "Where and when", id: "whereWhen" },
    { path: "myRole", label: "My role", id: "myRole" },
  ];
  if (flowShown(doc))
    doc.flow.forEach((_, i) => out.push({ path: `flow.${i}.step`, label: `Box ${i + 1}`, id: `flow-box-${i}` }, { path: `flow.${i}.detail`, label: `Box ${i + 1} detail` }));
  for (const it of pageItems(doc)) {
    if (it.kind === "flow") continue;
    const p = `sections.${it.index}`;
    const s = it.s;
    switch (s.kind) {
      case "findings":
        s.items.forEach((_, k) => out.push({ path: `${p}.items.${k}`, label: `Finding ${k + 1}` }));
        break;
      case "image":
        // 0026 names it "Image n caption"; the page parts cannot know n (see the renderer's report).
        out.push({ path: `${p}.caption`, label: "Image caption" });
        break;
      case "quote":
        out.push({ path: `${p}.text`, label: "The quote, word for word" }, { path: `${p}.name`, label: "Who said it" }, { path: `${p}.role`, label: "Their role (optional)" });
        break;
      case "reflection":
        out.push({ path: `${p}.text`, label: copy.reflection });
        break;
      case "aim":
        out.push({ path: `${p}.text`, label: s.heading === "hypothesis" ? "Hypothesis" : "Aim" });
        break;
      case "conclusion":
        out.push({ path: `${p}.text`, label: "Conclusion" });
        break;
      case "link":
        out.push({ path: `${p}.label`, label: "What the link is" }, { path: `${p}.description`, label: "One line about it (optional)" });
        break;
      case "pullquote":
        out.push({ path: `${p}.text`, label: "Pull quote" });
        break;
      case "graph":
        break;
    }
  }
  return out;
}

const firstOf = (row: Row): string => {
  const first = (c: Cell) => (c.cell === "item" ? c.item.id : c.items[0]!.item.id);
  return row.row === "one" ? first(row.cell) : row.row === "pair" ? first(row.left) : row.items[0]!.item.id;
};

/** Fonts in, every picture loaded, laid out. */
async function settle(page: Page) {
  await expect(page.locator("article[data-exhbt-page]")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => (img.addEventListener("load", done, { once: true }), img.addEventListener("error", done, { once: true }))))));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

type Box = { key: string; x: number; y: number; w: number; h: number };

/** What box for box compares (0026): every [data-part], the title, the context line, each pill and each flowchart box, relative to the article. */
function measure(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const root = document.querySelector("article[data-exhbt-page]")!.getBoundingClientRect();
    const out: Box[] = [];
    const add = (key: string, el: Element) => {
      const r = el.getBoundingClientRect();
      out.push({ key, x: r.x - root.x, y: r.y - root.y, w: r.width, h: r.height });
    };
    const seen = new Map<string, number>();
    const nth = (k: string) => {
      const n = (seen.get(k) ?? 0) + 1;
      seen.set(k, n);
      return `${k}#${n}`;
    };
    document.querySelectorAll("article [data-part]").forEach((el) => add(nth(`part ${el.getAttribute("data-part")}`), el));
    add("title", document.querySelector("article .xp-title")!);
    const context = document.querySelector("article .xp-context");
    if (context) add("context line", context);
    document.querySelectorAll("article .xp-pill:not(#skill-new)").forEach((el) => add(`pill ${el.textContent}`, el));
    document.querySelectorAll("article .xp-flow-box").forEach((el, i) => add(`flowchart box ${i + 1}`, el));
    return out;
  });
}

/** Each box that differs by more than half a pixel. */
function differences(want: Box[], got: Box[]): string[] {
  const off: string[] = [];
  const at = new Map(got.map((b) => [b.key, b]));
  for (const b of want) {
    const g = at.get(b.key);
    if (!g) off.push(`${b.key} is missing`);
    else if (Math.abs(b.x - g.x) > 0.5 || Math.abs(b.y - g.y) > 0.5 || Math.abs(b.w - g.w) > 0.5 || Math.abs(b.h - g.h) > 0.5)
      off.push(`${b.key} ${[b.x, b.y, b.w, b.h].map((v) => v.toFixed(1)).join(",")} is ${[g.x, g.y, g.w, g.h].map((v) => v.toFixed(1)).join(",")}`);
  }
  for (const g of got) if (!want.some((b) => b.key === g.key)) off.push(`${g.key} is extra`);
  return off;
}

/** The two edit-only fields 0026 keeps in the flow, by name. */
const FIELDS = { "image-description": "an image's description", "add-skill": "the Add a skill box" } as const;
const HIDE_FIELDS = Object.keys(FIELDS).map((k) => `[data-edit-only="${k}"]`).join(", ");

/**
 * The parts on 0026's list of what is in the flow in the editor only (placeholders), from an empty
 * field's path: its name, and the element the part uses on the page once it has words.
 */
const PLACEHOLDERS: { name: string; path: RegExp; part: string; kinds?: string[] }[] = [
  { name: "the context line", path: /^gap$/, part: "[data-slot-box]" },
  { name: "What it is", path: /^context$/, part: ".xp-fact" },
  { name: "Where and when", path: /^whereWhen$/, part: ".xp-fact" },
  { name: "My role", path: /^myRole$/, part: ".xp-fact" },
  { name: "a flowchart box's detail", path: /^flow\.\d+\.detail$/, part: ".xp-flow-detail" },
  { name: "an image's caption", path: /^sections\.\d+\.caption$/, part: "figcaption" },
  // The role is a part of the quote's line, not an element of its own: the field goes.
  { name: "a quote's role", path: /^sections\.\d+\.role$/, part: "[data-slot]" },
  { name: "a link's description", path: /^sections\.\d+\.description$/, part: "p, span.block" },
  { name: "an aim or a conclusion with no words", path: /^sections\.\d+\.text$/, part: "[data-slot=item]", kinds: ["aim", "conclusion"] },
];

for (const [name, doc] of Object.entries(SAMPLES)) {
  const f = formatOf(doc);
  const items = pageItems(doc);
  const rows = rowsFor(items, f);

  test.describe(`${name} (${FORMAT_RULES[f].name}): the slots`, () => {
    test("every field path in 0026's table is there once, with its name", async ({ page }) => {
      await page.goto(`/dev/edit-slots?sample=${name}`);
      await settle(page);
      const got = await page.locator("[data-slot=text], [data-slot=rich]").evaluateAll((els) => els.map((e) => ({ path: e.getAttribute("data-path")!, label: e.getAttribute("data-label")!, id: e.id || undefined })));
      const want = fieldsOf(doc);
      expect(got.map((g) => g.path).sort(), "the paths, each once").toEqual(want.map((w) => w.path).sort());
      for (const w of want) {
        const g = got.find((x) => x.path === w.path)!;
        expect(g.label, `${w.path}: its name`).toBe(w.label);
        if (w.id) expect(g.id, `${w.path}: its id`).toBe(w.id);
      }
      await expect(page.locator("[data-slot=skills]")).toHaveCount(1);
      await expect(page.locator("#skill-new")).toHaveCount(1);
      await expect(page.locator("[data-slot=work]")).toHaveCount(1);
    });

    test("one item slot per page item, a + before each row and one at the end, and the corner tools", async ({ page }) => {
      await page.goto(`/dev/edit-slots?sample=${name}`);
      await settle(page);
      const slots = await page.locator("[data-slot=item]").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-id"), index: Number(e.getAttribute("data-index")), count: Number(e.getAttribute("data-count")) })));
      expect(slots.map((s) => s.id), "an item slot per page item, in page order").toEqual(items.map((it) => it.id));
      slots.forEach((s, i) => expect([s.index, s.count], s.id!).toEqual([i, items.length]));

      const inserts = await page.locator("[data-slot=insert]").evaluateAll((els) => els.map((e) => ({ at: Number(e.getAttribute("data-at")), end: e.hasAttribute("data-end") })));
      const at = (id: string) => items.findIndex((it) => it.id === id);
      expect(inserts, "a + before each row, then the end one").toEqual([...rows.map((r) => ({ at: at(firstOf(r)), end: false })), { at: items.length, end: true }]);

      const tools = await page.locator("[data-slot=tools]").evaluateAll((els) => els.map((e) => e.getAttribute("data-block")));
      expect(tools.sort()).toEqual(["gap", "header", "skills"]);

      // Each part's own slots: a findings list's controls and its "Add a finding", a picture's label and
      // description, a graph's and a link's corner button, the aim's switch, and the flowchart's.
      const lists = await page.locator("[data-slot=list]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-path")} ${e.getAttribute("data-index")}/${e.getAttribute("data-n")}`));
      const wantLists = items.flatMap((it) => (it.kind === "findings" && it.s.kind === "findings" ? Array.from({ length: it.s.items.length + 1 }, (_, k) => `sections.${it.index}.items ${k}/${(it.s as { items: unknown[] }).items.length}`) : []));
      expect(lists.sort()).toEqual(wantLists.sort());
      const extras = await page.locator("[data-slot=extra]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-section")} ${e.getAttribute("data-kind")} ${e.getAttribute("data-where")}`));
      const wantExtras = items.flatMap((it) =>
        it.kind === "image" ? [`${it.id} image above`, `${it.id} image below`] : it.kind === "graph" || it.kind === "link" ? [`${it.id} ${it.kind} over`] : it.kind === "aim" ? [`${it.id} aim above`] : [],
      );
      expect(extras.sort()).toEqual(wantExtras.sort());
      const n = flowShown(doc) ? doc.flow.length : 0;
      await expect(page.locator("[data-slot=flow-list]")).toHaveCount(flowShown(doc) ? 1 : 0);
      await expect(page.locator("[data-slot=flow-box]")).toHaveCount(n);
      await expect(page.locator("[data-slot=flow-tools]")).toHaveCount(n);
      await expect(page.locator("[data-slot=flow-add]")).toHaveCount(n);
    });

    for (const [w, h] of [
      [1440, 900],
      [412, 915],
    ] as const) {
      test(`box for box at ${w}: a full page is the visitor's page but for the two edit-only fields`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`/dev/edit-slots?sample=${name}&read=1&full=1`);
        await settle(page);
        const visitor = await measure(page);

        await page.goto(`/dev/edit-slots?sample=${name}&full=1`);
        await settle(page);
        // The two fields as drawn: each description is the last thing in its picture's figure, under the caption;
        // the "Add a skill" box is the last of the pills, a pill's height.
        const fields = await page.evaluate(() => {
          const descriptions = [...document.querySelectorAll('[data-edit-only="image-description"]')].map((el) => {
            const fig = el.closest("figure")!;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
              last: fig.lastElementChild === el,
              afterCaption: el.previousElementSibling?.tagName === "FIGCAPTION",
              outer: r.height + parseFloat(cs.marginTop),
              figure: (({ x, width, height }) => ({ x, width, height }))(fig.getBoundingClientRect()),
            };
          });
          const add = document.querySelector("#skill-new")!;
          const pill = document.querySelector("article .xp-pill:not(#skill-new)");
          return { descriptions, addIsLast: add.parentElement!.lastElementChild === add, addH: add.getBoundingClientRect().height, pillH: pill?.getBoundingClientRect().height ?? 0 };
        });
        expect(fields.descriptions.length, "one description per picture").toBe(doc.sections.filter((s) => s.kind === "image").length);
        for (const d of fields.descriptions) expect([d.last, d.afterCaption], "the description sits last in its figure, under the caption").toEqual([true, true]);
        expect(fields.addIsLast, "Add a skill is the last of the pills").toBe(true);
        if (fields.pillH) expect(Math.abs(fields.addH - fields.pillH)).toBeLessThanOrEqual(0.5);

        // Taken out by name, the two fields leave nothing else different.
        await page.addStyleTag({ content: `${HIDE_FIELDS} { display: none !important; }` });
        await settle(page);
        expect(differences(visitor, await measure(page)), `${name} at ${w}: with ${Object.values(FIELDS).join(" and ")} taken out`).toEqual([]);

        // And each description adds exactly its own height to its figure, which keeps its place across.
        const without = await page.evaluate(() => [...document.querySelectorAll('[data-edit-only="image-description"]')].map((el) => (({ x, width, height }) => ({ x, width, height }))(el.closest("figure")!.getBoundingClientRect())));
        fields.descriptions.forEach((d, i) => {
          expect(Math.abs(d.figure.x - without[i]!.x) + Math.abs(d.figure.width - without[i]!.width), `picture ${i + 1}: across`).toBeLessThanOrEqual(0.5);
          expect(Math.abs(d.figure.height - without[i]!.height - d.outer), `picture ${i + 1}: grows by its description's line`).toBeLessThanOrEqual(0.5);
        });
      });

      test(`box for box at ${w}: on the sample as it is, only what 0026 lists differs`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`/dev/edit-slots?sample=${name}&read=1`);
        await settle(page);
        const visitor = await measure(page);

        await page.goto(`/dev/edit-slots?sample=${name}`);
        await settle(page);
        // Every empty part is drawn with its placeholder. Each must be on 0026's list; the part it is drawn in is marked.
        const empty = await page.evaluate((list) => {
          const named: string[] = [];
          const unknown: string[] = [];
          for (const el of document.querySelectorAll("[data-slot][data-empty]")) {
            if (el.getAttribute("data-slot") === "work") {
              el.parentElement!.setAttribute("data-hide", "");
              named.push("Add the work");
              continue;
            }
            const path = el.getAttribute("data-path") ?? "";
            const entry = list.find((x) => new RegExp(x.path).test(path));
            const part = entry && (entry.part === "[data-slot]" ? el : el.closest(entry.part));
            // A text of another kind (a quote's, a pull quote's) is not on the list.
            if (!entry || !part || (entry.kinds && !entry.kinds.includes(part.getAttribute("data-kind") ?? ""))) unknown.push(path);
            else {
              part.setAttribute("data-hide", "");
              named.push(`${entry.name} (${path})`);
            }
          }
          return { named, unknown };
        }, PLACEHOLDERS.map((p) => ({ ...p, path: p.path.source })));
        expect(empty.unknown, "empty parts the read-only page draws, or that 0026 does not list").toEqual([]);
        test.info().annotations.push({ type: "in the flow in the editor only", description: [...empty.named, ...Object.values(FIELDS)].join("; ") });

        // Taken out of the page, not only hidden: a hidden part still counts for a stack's "follows another" rule.
        await page.evaluate((fields) => document.querySelectorAll(`[data-hide], ${fields}`).forEach((el) => el.remove()), HIDE_FIELDS);
        await settle(page);
        expect(differences(visitor, await measure(page)), `${name} at ${w}, with these taken out: ${[...empty.named, ...Object.values(FIELDS)].join("; ")}`).toEqual([]);
      });
    }
  });
}
