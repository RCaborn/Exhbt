import { expect, test, type Page } from "./editor-test";
import { frame, freshName, grip, offered, openDoc, pageOrder, READY, sampleDoc, settle } from "./page-editor";

/*
 * TEMPORARY (branch phase-2-safari-hover, 26 Nov 2026): what WebKit's own hover does to the editor's tools after a
 * drop or a press, read from WebKit's runs. Every round writes a "[probe]" line to the job's log; nothing here fails a
 * run unless the page cannot be opened. The file goes once the runs are read. It matches the WebKit projects only
 * (playwright.config.ts, ONLY_WEBKIT), and a mouse's checks only.
 */

test.skip(({ isMobile }) => isMobile, "a mouse's");

const TALL = { width: 1440, height: 3600 };
const RULE = process.env.E2E_FOCUS === "safari" ? "rule" : "no rule";
const FLOW = `${READY} article .xe-flow`;
const BOX = `${READY} article [data-flow-step]`;
type Pt = { x: number; y: number };

/** Records, from inside each mousedown (capture), what it landed on and the state of the thing watched (`watch`). */
async function install(page: Page) {
  await page.evaluate(() => {
    type W = Window & { __probe?: { on: boolean; watch: [string, string]; presses: string[] } };
    const w = window as W;
    if (w.__probe?.on) return;
    w.__probe = { on: true, watch: ["", ""], presses: [] };
    window.addEventListener(
      "mousedown",
      (e) => {
        const p = w.__probe!;
        const name = (t: EventTarget | null) => (window as unknown as { __probeName: (t: EventTarget | null) => string }).__probeName(t);
        const s = (window as unknown as { __probeState: (a: string, b: string) => string }).__probeState(p.watch[0], p.watch[1]);
        p.presses.push(`press on ${name(e.target)}; there ${document.elementsFromPoint(e.clientX, e.clientY).slice(0, 2).map(name).join(" over ")}; ${s}`);
      },
      true,
    );
    (window as unknown as { __probeName: unknown }).__probeName = (t: EventTarget | null): string => {
      if (!(t instanceof Element)) return t === document ? "document" : String(t);
      const mark = ["data-grip", "data-tool", "data-flow-grip", "data-flow-remove", "data-flow-step", "data-section-id", "data-path"].find((a) => t.hasAttribute(a));
      const cls = [...t.classList].find((c) => c.startsWith("xe-") || c.startsWith("xp-"));
      return `${t.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${mark ? `[${mark}=${t.getAttribute(mark)}]` : ""}`;
    };
    (window as unknown as { __probeState: unknown }).__probeState = (subject: string, tools: string): string => {
      const name = (window as unknown as { __probeName: (t: EventTarget | null) => string }).__probeName;
      const el = subject ? document.querySelector(subject) : null;
      const t = tools ? document.querySelector(tools) : null;
      const cs = t ? getComputedStyle(t) : null;
      return `hovered ${el?.matches(":hover")}; tools ${cs?.opacity}/${cs?.pointerEvents}; focus on ${name(document.activeElement)}`;
    };
  });
}

/** The state of `subject` and its `tools` now, and, given `at`, whether `at` is inside `subject` (or its tools) and what is drawn there. */
const state = (page: Page, subject: string, tools: string, at?: Pt) =>
  page.evaluate(
    ({ subject, tools, at }) => {
      const name = (window as unknown as { __probeName: (t: EventTarget | null) => string }).__probeName;
      const s = (window as unknown as { __probeState: (a: string, b: string) => string }).__probeState(subject, tools);
      if (!at) return s;
      const within = (sel: string) => {
        const r = sel ? document.querySelector(sel)?.getBoundingClientRect() : null;
        return Boolean(r && at.x >= r.left && at.x <= r.right && at.y >= r.top && at.y <= r.bottom);
      };
      return `${s}; pointer inside ${within(subject) ? "it" : within(tools) ? "its tools" : "neither"}; there ${document.elementsFromPoint(at.x, at.y).slice(0, 2).map(name).join(" over ")}`;
    },
    { subject, tools, at },
  );

const watch = (page: Page, subject: string, tools: string) =>
  page.evaluate(([a, b]) => {
    const p = (window as Window & { __probe?: { watch: [string, string]; presses: string[] } }).__probe!;
    p.watch = [a!, b!];
    p.presses = [];
  }, [subject, tools]);
const presses = (page: Page) => page.evaluate(() => (window as Window & { __probe?: { presses: string[] } }).__probe?.presses ?? []);
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => null));
const middle = (b: { x: number; y: number; width: number; height: number }): Pt => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const log = (lines: string[]) => console.log(lines.join("\n"));

/* ------------------------------------------------------------------------------------------------
 * Case 1: a section dropped by mouse, then picked up again at once
 * ---------------------------------------------------------------------------------------------- */

for (const f of offered()) {
  test(`TEMPORARY probe, ${f}: a section dropped by mouse, picked up again at once from where the pointer is`, async ({ page }) => {
    await page.setViewportSize(TALL);
    await openDoc(page, freshName(`hp${f}`), sampleDoc(f));
    await settle(page);
    await install(page);
    const id = (await pageOrder(page)).at(-1)!;
    const F = `${READY} article [data-section-id="${id}"]`;
    const T = `${F} > .xe-tools`;
    const lifting = page.locator(`${READY} [data-xe-drag]`);
    const out = [`[probe] case 1, ${f}, ${RULE}: section ${id}, the last, carried to the top and back`];
    let at: Pt = { x: 5, y: 5 };
    let held = false;
    await page.mouse.move(5, 5);
    for (let round = 0; round < 6; round++) {
      const now = await pageOrder(page);
      const toTop = now[0] !== id;
      // Picked up the usual way (onto the section, then its grip) when the last round's pick-up failed or this is the first.
      if (!held) {
        await frame(page, id).hover();
        at = middle((await grip(page, id).boundingBox())!);
        await page.mouse.move(at.x, at.y, { steps: 3 });
        await page.mouse.down();
        await page.mouse.move(at.x + 4, at.y + 8, { steps: 4 });
        at = { x: at.x + 4, y: at.y + 8 };
        const ok = await lifting.waitFor({ state: "attached", timeout: 3000 }).then(() => true, () => false);
        if (!ok) {
          out.push(`  round ${round}: the usual pick-up did not lift`);
          await page.mouse.up();
          continue;
        }
      }
      // Into the room the section will land in, so the pointer is on it when it lands: the top of the first, or the foot of the last.
      const other = toTop ? now[0]! : now.at(-1)!;
      const b = (await frame(page, other).boundingBox())!;
      const to = toTop ? { x: b.x + b.width / 2, y: b.y + 8 } : { x: b.x + b.width / 2, y: b.y + b.height - 8 };
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await page.waitForTimeout(150);
      const place = await page.evaluate(() => window.__exhbtDrag?.state()?.place ?? null);
      await page.mouse.up();
      await settled(page);
      await page.waitForTimeout(100);
      const moved = (await pageOrder(page)).indexOf(id);
      out.push(`  round ${round}: dropped ${toTop ? "at the top" : "at the end"} (place ${place}, now ${moved}); just after: ${await state(page, F, T, to)}`);
      // The pointer moves a little, staying where it is (on the section if it landed under it).
      await page.mouse.move(to.x + 3, to.y - 3, { steps: 2 });
      out.push(`    moved 3px: ${await state(page, F, T, { x: to.x + 3, y: to.y - 3 })}`);
      // Straight to the grip, and pressed.
      const g = middle((await grip(page, id).boundingBox())!);
      await page.mouse.move(g.x, g.y, { steps: 6 });
      out.push(`    at the grip: ${await state(page, F, T, g)}`);
      await watch(page, F, T);
      await page.mouse.down();
      await page.mouse.move(g.x + 4, g.y + 8, { steps: 4 });
      held = await lifting.waitFor({ state: "attached", timeout: 2500 }).then(() => true, () => false);
      out.push(`    ${(await presses(page)).join(" | ")}; ${held ? "LIFTED" : "NOT LIFTED"}`);
      if (!held) {
        await page.mouse.up();
        await page.mouse.move(5, 5, { steps: 4 });
      }
    }
    if (held) {
      await page.keyboard.press("Escape");
      await page.mouse.up();
    }
    log(out);
  });
}

/* ------------------------------------------------------------------------------------------------
 * Case 3: a flowchart box dropped by mouse, then a click on its grip with no drag, then a pick-up
 * ---------------------------------------------------------------------------------------------- */

for (const f of offered()) {
  test(`TEMPORARY probe, ${f}: a flowchart box dropped by mouse, its grip clicked with no drag, then picked up`, async ({ page }) => {
    await page.setViewportSize(TALL);
    const doc = sampleDoc(f);
    await openDoc(page, freshName(`hq${f}`), f === "case-study" ? { ...doc, flow: doc.flow.slice(0, 5) } : doc);
    await settle(page);
    await install(page);
    const axis = (await page.locator(FLOW).getAttribute("data-axis")) as "row" | "column";
    const boxAt = (i: number) => page.locator(BOX).nth(i);
    const B = (i: number) => `${BOX}:nth-child(${i + 1})`;
    const out = [`[probe] case 3, ${f}, ${RULE}: a ${axis}`];
    const lifted = () => page.locator(`${FLOW}[data-flow-drag="pointer"]`).waitFor({ state: "attached", timeout: 2500 }).then(() => true, () => false);
    // The boxes are the list's only children that are <li>: nth-child counts them.
    expect(await page.locator(`${FLOW} > ol > li`).count()).toBe(await page.locator(BOX).count());
    let at = 0;
    let held = false;
    await page.mouse.move(5, 5);
    for (let round = 0; round < 6; round++) {
      const to = at === 0 ? 2 : 0;
      if (!held) {
        await boxAt(at).hover();
        const g = middle((await boxAt(at).locator("[data-flow-grip]").boundingBox())!);
        await page.mouse.move(g.x, g.y, { steps: 3 });
        await page.mouse.down();
        await page.mouse.move(g.x + 2, g.y + 2, { steps: 2 });
        await page.mouse.move(g.x + 6, g.y + 6, { steps: 3 });
        if (!(await lifted())) {
          out.push(`  round ${round}: the usual pick-up did not lift`);
          await page.mouse.up();
          continue;
        }
      }
      const r = (await boxAt(to).locator(".xp-flow-box").boundingBox())!;
      const share = to > at ? 0.7 : 0.3;
      const p = axis === "row" ? { x: r.x + r.width * share, y: r.y + r.height / 2 } : { x: r.x + r.width / 2, y: r.y + r.height * share };
      await page.mouse.move(p.x, p.y, { steps: 15 });
      await page.waitForTimeout(120);
      await page.mouse.up();
      await settled(page);
      await page.waitForTimeout(100);
      at = to;
      const S = `${B(at)}`;
      const T = `${B(at)} > .xp-flow-box > .xe-flow-tools`;
      out.push(`  round ${round}: dropped in place ${to + 1}; just after: ${await state(page, S, T, p)}`);
      // A click on the grip, no drag.
      const g = middle((await boxAt(at).locator("[data-flow-grip]").boundingBox())!);
      await page.mouse.move(g.x, g.y, { steps: 4 });
      out.push(`    at the grip: ${await state(page, S, T, g)}`);
      await watch(page, S, T);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(100);
      out.push(`    clicked: ${(await presses(page)).join(" | ")}; then ${await state(page, S, T, g)}`);
      // Over the box's words, and back to the grip, never leaving the box.
      const w = middle((await boxAt(at).locator(".xp-flow-box").boundingBox())!);
      await page.mouse.move(w.x, w.y, { steps: 4 });
      out.push(`    on its words: ${await state(page, S, T, w)}`);
      await page.mouse.move(g.x, g.y, { steps: 4 });
      await watch(page, S, T);
      await page.mouse.down();
      await page.mouse.move(g.x + 2, g.y + 2, { steps: 2 });
      await page.mouse.move(g.x + 6, g.y + 6, { steps: 3 });
      held = await lifted();
      out.push(`    ${(await presses(page)).join(" | ")}; ${held ? "LIFTED" : "NOT LIFTED"}`);
      if (!held) {
        await page.mouse.up();
        await page.mouse.move(5, 5, { steps: 4 });
      }
    }
    if (held) {
      await page.keyboard.press("Escape");
      await page.mouse.up();
    }
    log(out);
  });
}

/* ------------------------------------------------------------------------------------------------
 * Case 4: the flowchart dropped as a section (its "+" and boxes' tools hang on .xe-flow:hover); a skill removed; a finding moved
 * ---------------------------------------------------------------------------------------------- */

for (const f of offered()) {
  test(`TEMPORARY probe, ${f}: the flowchart dropped as a section by mouse, with the pointer on it`, async ({ page }) => {
    await page.setViewportSize(TALL);
    await openDoc(page, freshName(`hr${f}`), sampleDoc(f));
    await settle(page);
    await install(page);
    const F = `${READY} article [data-section-id="flow"]`;
    const out = [`[probe] case 4, the flowchart as a section, ${f}, ${RULE}`];
    const lifting = page.locator(`${READY} [data-xe-drag]`);
    for (let round = 0; round < 2; round++) {
      const now = await pageOrder(page);
      const toTop = round === 1;
      await page.mouse.move(5, 5);
      await frame(page, "flow").hover();
      const g = middle((await grip(page, "flow").boundingBox())!);
      await page.mouse.move(g.x, g.y, { steps: 3 });
      await page.mouse.down();
      await page.mouse.move(g.x + 4, g.y + 8, { steps: 4 });
      if (!(await lifting.waitFor({ state: "attached", timeout: 3000 }).then(() => true, () => false))) {
        out.push(`  round ${round}: did not lift`);
        await page.mouse.up();
        continue;
      }
      const other = toTop ? now.find((x) => x !== "flow")! : now.filter((x) => x !== "flow").at(-1)!;
      const b = (await frame(page, other).boundingBox())!;
      const to = toTop ? { x: b.x + b.width / 2, y: b.y + 8 } : { x: b.x + b.width / 2, y: b.y + b.height - 8 };
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await page.waitForTimeout(150);
      await page.mouse.up();
      await settled(page);
      await page.waitForTimeout(100);
      out.push(`  round ${round}: dropped ${toTop ? "at the top" : "at the end"} (now ${(await pageOrder(page)).indexOf("flow")}); the frame: ${await state(page, F, `${F} > .xe-tools`, to)}`);
      out.push(`    the list: ${await state(page, FLOW, `${FLOW} .xe-flow-add`, to)}`);
      await page.mouse.move(to.x + 3, to.y - 3, { steps: 2 });
      out.push(`    moved 3px, the list: ${await state(page, FLOW, `${FLOW} .xe-flow-add`)}`);
      // Over the middle of the flowchart, without leaving it if the pointer was on it.
      const l = middle((await page.locator(FLOW).boundingBox())!);
      await page.mouse.move(l.x, l.y, { steps: 5 });
      const box = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-flow-step]")?.getAttribute("data-flow-step") ?? null, l);
      out.push(`    at its middle, the list: ${await state(page, FLOW, `${FLOW} .xe-flow-add`, l)}${box ? `; the box there: ${await state(page, `${BOX}[data-flow-step="${box}"]`, `${BOX}[data-flow-step="${box}"] > .xp-flow-box > .xe-flow-tools`)}` : ""}`);
    }
    log(out);
  });
}

test("TEMPORARY probe, case study: a skill removed and a finding moved under the pointer", async ({ page }) => {
  await page.setViewportSize(TALL);
  await openDoc(page, freshName("hs"), sampleDoc("case-study"));
  await settle(page);
  await install(page);
  const out = [`[probe] case 4, skills and findings, ${RULE}`];
  for (let round = 0; round < 3; round++) {
    const pill = page.locator(`${READY} .xe-pill`).first();
    await pill.hover();
    const x = middle((await pill.locator(".xe-pill-remove").boundingBox())!);
    await page.mouse.move(x.x, x.y, { steps: 3 });
    await watch(page, `${READY} .xe-pill:first-child`, `${READY} .xe-pill:first-child > .xe-pill-remove`);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
    out.push(`  skill round ${round}: ${(await presses(page)).join(" | ")}; then the pill now first: ${await state(page, `${READY} .xe-pill:first-child`, `${READY} .xe-pill:first-child > .xe-pill-remove`, x)}`);
    await page.mouse.move(x.x + 1, x.y + 1, { steps: 1 });
    out.push(`    moved 1px: ${await state(page, `${READY} .xe-pill:first-child`, `${READY} .xe-pill:first-child > .xe-pill-remove`, { x: x.x + 1, y: x.y + 1 })}`);
  }
  const li = `${READY} article [data-section-id="findings"] ul > li:first-child`;
  for (let round = 0; round < 3; round++) {
    await page.locator(li).hover();
    const down = page.locator(`${li} .xe-list-tools [aria-label^="Move finding 1 down"]`);
    const d = middle((await down.boundingBox())!);
    await page.mouse.move(d.x, d.y, { steps: 3 });
    await watch(page, li, `${li} > .xe-list-tools`);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
    out.push(`  finding round ${round}: ${(await presses(page)).join(" | ")}; then ${await state(page, li, `${li} > .xe-list-tools`, d)}`);
    await page.mouse.move(d.x + 1, d.y + 1, { steps: 1 });
    out.push(`    moved 1px: ${await state(page, li, `${li} > .xe-list-tools`, { x: d.x + 1, y: d.y + 1 })}`);
  }
  log(out);
});
