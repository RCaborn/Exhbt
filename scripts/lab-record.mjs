// Records short videos of the editor lab (/lab/editor) for docs/briefs/edit-on-page/drag-prototype.md:
// each drag version carrying a section past a pair and through the image grid, a flow box being
// dragged, and typing in the title and a finding, on a 1440px desktop (mouse) and a Pixel 7 (touch).
//
//   node scripts/lab-record.mjs [base URL] [output folder]
//
// Run it against a production build (EXHBT_LAB=1 next start), so the development badge isn't in
// the picture. Videos are .webm; a few stills are saved beside them as .png. A dot is drawn where
// the pointer or the finger is, because a recording doesn't show either.
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] || "http://localhost:3213";
const out = process.argv[3] || "lab-recordings";
mkdirSync(out, { recursive: true });

const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = devices["Pixel 7"];

/** Draws a dot under the pointer (and a ring under a finger), so the recording shows where it is. */
const POINTER = () => {
  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  dot.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(201,35,36,.75);border:2px solid #fff;pointer-events:none;z-index:2147483647;display:none";
  const show = (x, y, big) => {
    if (!dot.isConnected) document.body.appendChild(dot);
    dot.style.display = "block";
    dot.style.width = dot.style.height = big ? "34px" : "18px";
    dot.style.margin = big ? "-17px 0 0 -17px" : "-9px 0 0 -9px";
    dot.style.transform = `translate(${x}px, ${y}px)`;
  };
  window.addEventListener("mousemove", (e) => show(e.clientX, e.clientY, false), true);
  window.addEventListener("mousedown", () => (dot.style.background = "rgba(201,35,36,1)"), true);
  window.addEventListener("mouseup", () => (dot.style.background = "rgba(201,35,36,.75)"), true);
  const touch = (e) => (e.touches[0] ? show(e.touches[0].clientX, e.touches[0].clientY, true) : (dot.style.display = "none"));
  for (const type of ["touchstart", "touchmove", "touchend"]) window.addEventListener(type, touch, { capture: true, passive: true });
};

const browser = await chromium.launch();
const made = [];

/** One clip: its own context, so its own video file, named after the clip. */
async function clip(name, device, query, play) {
  const dir = join(out, `.tmp-${name}`);
  const context = await browser.newContext({ ...device, recordVideo: { dir, size: device.viewport } });
  const page = await context.newPage();
  await page.addInitScript(POINTER);
  await page.goto(`${base}/lab/editor${query}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-lab][data-ready]");
  await page.waitForSelector('[data-lab-context="field"]');
  await page.evaluate(() => document.fonts.ready);
  const cdp = await context.newCDPSession(page);
  const still = (label) => page.screenshot({ path: join(out, `${name}-${label}.png`) });
  await play({ page, still, mouse: mouseOn(page), finger: fingerOn(page, cdp) });
  await page.waitForTimeout(700);
  await context.close();
  const file = readdirSync(dir).find((f) => f.endsWith(".webm"));
  renameSync(join(dir, file), join(out, `${name}.webm`));
  rmSync(dir, { recursive: true, force: true });
  made.push(`${name}.webm`);
  console.log(`recorded ${name}`);
}

const section = (page, id) => page.locator(`[data-lab-rows] [data-lab-section="${id}"]`);
const centre = (b, fx = 0.5, fy = 0.5) => ({ x: b.x + b.width * fx, y: b.y + b.height * fy });

/** Moves at a hand's pace: about 16ms a step. */
function mouseOn(page) {
  let at = { x: 0, y: 0 };
  return {
    async to(p, ms = 600) {
      const steps = Math.max(2, Math.round(ms / 16));
      const from = at;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + ((p.x - from.x) * i) / steps, from.y + ((p.y - from.y) * i) / steps);
        await page.waitForTimeout(16);
      }
      at = p;
    },
    async grab(locator) {
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const p = centre(await locator.boundingBox());
      await this.to(p, 500);
      await page.waitForTimeout(200);
      await page.mouse.down();
      await this.to({ x: p.x + 3, y: p.y + 9 }, 120);
    },
    drop: () => page.mouse.up(),
  };
}

function fingerOn(page, cdp) {
  let at = { x: 0, y: 0 };
  const send = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
  return {
    /** A press on a handle, held long enough to pick up. */
    async press(locator) {
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      at = centre(await locator.boundingBox());
      await send("touchStart", at);
      await page.waitForTimeout(280);
    },
    async to(p, ms = 700) {
      const steps = Math.max(2, Math.round(ms / 16));
      const from = at;
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", { x: from.x + ((p.x - from.x) * i) / steps, y: from.y + ((p.y - from.y) * i) / steps });
        await page.waitForTimeout(16);
      }
      at = p;
    },
    lift: () => send("touchEnd"),
    /** A swipe that scrolls: down on `from`, a quick move by `dy`, up. */
    async swipe(from, dy) {
      at = from;
      await send("touchStart", from);
      await this.to({ x: from.x, y: from.y + dy }, 260);
      await send("touchEnd");
      await page.waitForTimeout(700);
    },
    tap: (p) => page.touchscreen.tap(p.x, p.y),
  };
}

const box = async (page, id) => await section(page, id).boundingBox();

for (const v of ["a", "b"]) {
  // Desktop: a section carried past the findings-and-graph pair, resting beside it, between its two halves, and above it.
  await clip(`desktop-${v}-pair`, DESKTOP, `?sample=case-study&v=${v}`, async ({ page, mouse, still }) => {
    await page.waitForTimeout(500);
    await mouse.grab(section(page, "quote-1").locator("[data-grip]"));
    const g2 = await box(page, "graph-2");
    await mouse.to(centre(g2, 0.6, 0.3), 700);
    await page.waitForTimeout(500);
    const g1 = await box(page, "graph-1");
    const f = await box(page, "findings");
    await mouse.to(centre(g1, 0.7, 0.6), 700);
    await page.waitForTimeout(500);
    await mouse.to({ x: (f.x + f.width + g1.x) / 2, y: f.y + f.height / 2 }, 600);
    await page.waitForTimeout(600);
    await still("between");
    await mouse.to(centre(f, 0.4, 0.5), 600);
    await page.waitForTimeout(500);
    await mouse.to(centre(f, 0.5, 0.02), 600);
    await page.waitForTimeout(600);
    await still("above");
    await mouse.drop();
    await page.waitForTimeout(900);
    // And a graph dropped next to the findings, to see a pair form on the drop.
    await mouse.grab(section(page, "graph-2").locator("[data-grip]"));
    const q = await box(page, "quote-1");
    await mouse.to(centre(q, 0.5, 0.2), 900);
    await page.waitForTimeout(600);
    await still("pairing");
    await mouse.drop();
    await page.waitForTimeout(900);
    await still("paired");
  });

  // Desktop: a tile carried through the image grid, then a link carried into it.
  await clip(`desktop-${v}-grid`, DESKTOP, `?sample=gallery&v=${v}`, async ({ page, mouse, still }) => {
    await section(page, "image-2").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 220));
    await page.waitForTimeout(500);
    await mouse.grab(section(page, "image-2").locator("[data-grip]"));
    for (const [id, fx] of [["image-3", 0.8], ["image-4", 0.8], ["image-5", 0.2], ["image-6", 0.2], ["image-6", 0.8]]) {
      await mouse.to(centre(await box(page, id), fx, 0.5), 550);
      await page.waitForTimeout(450);
      if (id === "image-4") await still("in-row");
    }
    await still("next-row");
    await mouse.drop();
    await page.waitForTimeout(900);
    await mouse.grab(section(page, "link-1").locator("[data-grip]"));
    await mouse.to(centre(await box(page, "image-4"), 0.9, 0.5), 800);
    await page.waitForTimeout(700);
    await still("link-into-grid");
    await mouse.drop();
    await page.waitForTimeout(900);
  });

  // Phone: past the pair (stacked on a phone), with the page scrolling itself under the finger.
  await clip(`phone-${v}-pair`, PHONE, `?sample=case-study&v=${v}`, async ({ page, finger, still }) => {
    await section(page, "quote-1").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -260));
    await page.waitForTimeout(500);
    await finger.press(section(page, "quote-1").locator("[data-grip]"));
    const g2 = await box(page, "graph-2");
    await finger.to(centre(g2, 0.6, 0.4), 800);
    await page.waitForTimeout(500);
    await still("over-graph");
    // To the top edge, and held: the page scrolls up under it.
    await finger.to({ x: 240, y: 70 }, 800);
    await page.waitForTimeout(1400);
    await finger.to({ x: 230, y: 150 }, 300);
    await page.waitForTimeout(500);
    await still("after-scroll");
    await finger.lift();
    await page.waitForTimeout(900);
  });

  // Phone: through the two-column image grid; first a swipe on a picture, which only scrolls.
  await clip(`phone-${v}-grid`, PHONE, `?sample=gallery&v=${v}`, async ({ page, finger, still }) => {
    await section(page, "link-1").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const pic = await box(page, "image-3");
    await finger.swipe(centre(pic, 0.5, 0.6), -170);
    await finger.press(section(page, "image-2").locator("[data-grip]"));
    for (const [id, fx] of [["image-3", 0.75], ["image-5", 0.75], ["image-4", 0.25], ["image-6", 0.75]]) {
      await finger.to(centre(await box(page, id), fx, 0.5), 650);
      await page.waitForTimeout(450);
      if (id === "image-5") await still("mid");
    }
    await still("end");
    await finger.lift();
    await page.waitForTimeout(900);
  });
}

// Flow boxes: one dragged along the row (desktop) and down the column (phone), and a box added on an arrow.
await clip("desktop-flow-box", DESKTOP, "?sample=case-study&v=b", async ({ page, mouse, still }) => {
  await page.waitForTimeout(400);
  const step = (n) => page.locator(`[data-flow-step="step-${n}"]`);
  await mouse.to(centre(await step(1).boundingBox()), 400);
  await mouse.grab(step(1).locator("[data-flow-grip]"));
  await mouse.to(centre(await step(3).locator(".xp-flow-box").boundingBox(), 0.7, 0.5), 900);
  await page.waitForTimeout(500);
  await still("mid");
  await mouse.drop();
  await page.waitForTimeout(700);
  const add = page.locator('[data-flow-add="2"]');
  await mouse.to(centre(await add.boundingBox()), 500);
  await page.waitForTimeout(300);
  await add.click();
  await page.keyboard.type("Check the fixed points", { delay: 45 });
  await page.waitForTimeout(500);
  await still("added");
});
await clip("phone-flow-box", PHONE, "?sample=case-study&v=b", async ({ page, finger, still }) => {
  const step = (n) => page.locator(`[data-flow-step="step-${n}"]`);
  await step(1).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await finger.press(step(1).locator("[data-flow-grip]"));
  await finger.to(centre(await step(3).locator(".xp-flow-box").boundingBox(), 0.8, 0.7), 900);
  await page.waitForTimeout(500);
  await still("mid");
  await finger.lift();
  await page.waitForTimeout(900);
});

// Typing in the title and a finding, in the page's own type.
for (const [name, device] of [["desktop-typing", DESKTOP], ["phone-typing", PHONE]]) {
  await clip(name, device, "?sample=case-study&v=b", async ({ page, still }) => {
    const title = page.getByLabel("Title");
    await title.scrollIntoViewIfNeeded();
    await title.click();
    await page.keyboard.press("Control+End");
    await page.waitForTimeout(400);
    for (let i = 0; i < 13; i++) await page.keyboard.press("Backspace", { delay: 35 });
    await page.keyboard.type("the new rules?", { delay: 70 });
    await page.waitForTimeout(500);
    await still("title");
    const finding = page.getByLabel("Finding 1");
    await finding.scrollIntoViewIfNeeded();
    await finding.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Bank payoffs barely move, even when the access fee is doubled.", { delay: 55 });
    await page.waitForTimeout(500);
    await still("finding");
    const line = page.getByRole("textbox", { name: "Context line" });
    await line.scrollIntoViewIfNeeded();
    await line.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" It matters to both.", { delay: 55 });
    await page.waitForTimeout(600);
    await still("context");
  });
}

await browser.close();
console.log(`\n${made.length} videos in ${out}:\n${made.map((f) => `  ${f}`).join("\n")}`);
