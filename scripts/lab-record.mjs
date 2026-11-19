// Records short videos of the editor lab (/lab/editor) for docs/briefs/edit-on-page/drag-prototype.md:
// each drag version carrying a section past a pair and through the image grid, Mix carrying the
// flowchart, a flow box being dragged both ways, a block dragged in from the tray, the "+" menu,
// and typing in the title and a finding, on a 1440px desktop (mouse) and a Pixel 7 (touch).
//
//   node scripts/lab-record.mjs [base URL] [output folder] [only: a name to match]
//
// Run it against a production build (EXHBT_LAB=1 next start), so the development badge isn't in
// the picture. Videos are .webm; a few stills are saved beside them as .png. A dot is drawn where
// the pointer or the finger is, because a recording doesn't show either.
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] || "http://localhost:3213";
const out = process.argv[3] || "lab-recordings";
const only = process.argv[4] || "";
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
  if (only && !name.includes(only)) return;
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
  const hand = device === PHONE ? fingerOn(page, cdp) : mouseOn(page);
  try {
    await play({ page, still, hand });
  } catch (e) {
    console.log(`  ${name}: ${String(e).split("\n")[0]}`);
  }
  await page.waitForTimeout(700);
  await context.close();
  const file = readdirSync(dir).find((f) => f.endsWith(".webm"));
  renameSync(join(dir, file), join(out, `${name}.webm`));
  rmSync(dir, { recursive: true, force: true });
  made.push(`${name}.webm`);
  console.log(`recorded ${name}`);
}

const section = (page, id) => page.locator(`[data-lab-rows] [data-lab-section="${id}"]`);
/** A point in a section's box, as it is on the screen now. Read again at every step of a move, because the page scrolls itself under a carried section. */
const inside = (page, selector, fx = 0.5, fy = 0.5) => async () => {
  const b = await page.locator(selector).first().boundingBox();
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
};
const sec = (page, id, fx, fy) => inside(page, `[data-lab-rows] [data-lab-section="${id}"]`, fx, fy);
const between = (page, a, b) => async () => {
  const A = await section(page, a).boundingBox();
  const B = await section(page, b).boundingBox();
  return { x: (A.x + A.width + B.x) / 2, y: A.y + A.height / 2 };
};

/** A hand at a hand's pace: about 16ms a step, homing in on a target that may be moving. */
function handOn(page, down, move, up) {
  let at = { x: 0, y: 0 };
  return {
    /** Moves to a point, or to wherever `target()` says the point is now. */
    async to(target, ms = 650) {
      const steps = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const p = typeof target === "function" ? await target() : target;
        at = { x: at.x + (p.x - at.x) / (steps - i + 1), y: at.y + (p.y - at.y) / (steps - i + 1) };
        await move(at);
        await page.waitForTimeout(16);
      }
      // The page may still be scrolling: keep to the target until it holds still.
      for (let i = 0; i < 80 && typeof target === "function"; i++) {
        const p = await target();
        if (Math.hypot(p.x - at.x, p.y - at.y) < 3) break;
        at = { x: at.x + (p.x - at.x) * 0.35, y: at.y + (p.y - at.y) * 0.35 };
        await move(at);
        await page.waitForTimeout(16);
      }
    },
    /** Takes hold of a handle: a press held long enough to pick up by touch, a press and a nudge by mouse. */
    async grab(locator) {
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      const b = await locator.boundingBox();
      const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      at = await down(p, at);
      await this.to({ x: p.x + 3, y: p.y + 9 }, 130);
    },
    rest: (ms = 500) => page.waitForTimeout(ms),
    drop: () => up(),
  };
}
const mouseOn = (page) =>
  handOn(
    page,
    async (p, from) => {
      for (let i = 1; i <= 25; i++) {
        await page.mouse.move(from.x + ((p.x - from.x) * i) / 25, from.y + ((p.y - from.y) * i) / 25);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(200);
      await page.mouse.down();
      return p;
    },
    (p) => page.mouse.move(p.x, p.y),
    () => page.mouse.up(),
  );
const fingerOn = (page, cdp) => {
  const send = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
  const hand = handOn(
    page,
    async (p) => {
      await send("touchStart", p);
      await page.waitForTimeout(280);
      return p;
    },
    (p) => send("touchMove", p),
    () => send("touchEnd"),
  );
  /** A swipe that scrolls: down on a point, a quick move by `dy`, up. */
  hand.swipe = async (from, dy) => {
    await send("touchStart", from);
    for (let i = 1; i <= 14; i++) {
      await send("touchMove", { x: from.x, y: from.y + (dy * i) / 14 });
      await page.waitForTimeout(16);
    }
    await send("touchEnd");
    await page.waitForTimeout(700);
  };
  return hand;
};

const grip = (page, id) => section(page, id).locator("> .lab-tools [data-grip]");

for (const [kind, device] of [["desktop", DESKTOP], ["phone", PHONE]]) {
  for (const v of ["a", "b"]) {
    // A section carried past the findings-and-graph pair: resting beside it, between its two halves, and above it.
    await clip(`${kind}-${v}-pair`, device, `?sample=case-study&v=${v}`, async ({ page, hand, still }) => {
      await hand.grab(grip(page, "quote-1"));
      await hand.to(sec(page, "graph-2", 0.6, 0.3), 800);
      await hand.rest();
      await hand.to(sec(page, "graph-1", 0.7, 0.6), 800);
      await hand.rest();
      await still("beside");
      await hand.to(between(page, "findings", "graph-1"), 600);
      await hand.rest(700);
      await still("between");
      await hand.to(sec(page, "findings", 0.5, 0.04), 700);
      await hand.rest(700);
      await still("above");
      await hand.drop();
      await page.waitForTimeout(900);
      if (kind === "desktop") {
        // And the second graph dropped between the findings and the first, to see pairs form on the drop.
        await hand.grab(grip(page, "graph-2"));
        await hand.to(between(page, "findings", "graph-1"), 900);
        await hand.rest(700);
        await still("pairing");
        await hand.drop();
        await page.waitForTimeout(900);
        await still("paired");
      }
    });

    // A tile carried through the image grid; on the phone, first a swipe on a picture, which only scrolls.
    await clip(`${kind}-${v}-grid`, device, `?sample=gallery&v=${v}`, async ({ page, hand, still }) => {
      if (kind === "phone") {
        await section(page, "link-1").scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await hand.swipe(await sec(page, "image-3", 0.5, 0.6)(), -170);
      }
      await hand.grab(grip(page, "image-2"));
      for (const [id, fx] of [["image-3", 0.8], ["image-4", 0.8], ["image-5", 0.25], ["image-6", 0.8]]) {
        await hand.to(sec(page, id, fx, 0.5), 600);
        await hand.rest(450);
        if (id === "image-4") await still("in-row");
      }
      await still("next-row");
      await hand.drop();
      await page.waitForTimeout(900);
      if (kind === "desktop") {
        await hand.grab(grip(page, "link-1"));
        await hand.to(sec(page, "image-5", 0.9, 0.5), 900);
        await hand.rest(700);
        await still("link-into-grid");
        await hand.drop();
        await page.waitForTimeout(900);
      }
    });
  }

  // Mix: the flowchart carried down the page over a still page, then a short section carried up, with the page making room.
  await clip(`${kind}-mix-flowchart`, device, "?sample=case-study&v=mix", async ({ page, hand, still }) => {
    await hand.grab(grip(page, "flow"));
    await hand.to(sec(page, "findings", 0.5, 0.5), 700);
    await hand.rest();
    await hand.to(sec(page, "graph-2", 0.5, 0.95), 1100);
    await hand.rest(700);
    await still("line");
    await hand.drop();
    await page.waitForTimeout(900);
    await hand.grab(grip(page, "quote-1"));
    await hand.to(sec(page, "graph-2", 0.5, 0.05), 900);
    await hand.rest(700);
    await still("slide");
    await hand.drop();
    await page.waitForTimeout(900);
  });

  // A flow box, both ways: carried with a line (Mix), and sliding the others aside (A).
  for (const [v, way] of [["mix", "line"], ["a", "slide"]]) {
    await clip(`${kind}-flow-box-${way}`, device, `?sample=case-study&v=${v}`, async ({ page, hand, still }) => {
      const step = (n) => `[data-flow-step="step-${n}"]`;
      await hand.grab(page.locator(`${step(1)} [data-flow-grip]`));
      await hand.to(inside(page, `${step(2)} .xp-flow-box`, 0.7, 0.6), 600);
      await hand.rest(500);
      await hand.to(inside(page, `${step(3)} .xp-flow-box`, 0.75, 0.7), 600);
      await hand.rest(600);
      await still("mid");
      await hand.drop();
      await page.waitForTimeout(800);
      await still("dropped");
    });
  }

  // Typing in the title, a finding and the context line, in the page's own type.
  await clip(`${kind}-typing`, device, "?sample=case-study", async ({ page, still }) => {
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

// The tray (desktop only): a block dragged in beside the findings, a section removed, and a block added with Enter.
await clip("desktop-tray", DESKTOP, "?sample=research", async ({ page, hand, still }) => {
  await page.waitForTimeout(500);
  await still("rest");
  await hand.grab(page.locator('[data-tray-kind="quote"]'));
  await hand.to(sec(page, "conclusion-1", 0.5, 0.5), 900);
  await hand.rest(600);
  await hand.to(sec(page, "image-1", 0.5, 0.03), 900);
  await hand.rest(700);
  await still("carrying");
  await hand.drop();
  await page.waitForTimeout(900);
  await hand.grab(page.locator('[data-tray-kind="image"]'));
  await hand.to(sec(page, "reflection-1", 0.4, 0.1), 1000);
  await hand.rest(700);
  await hand.drop();
  await page.waitForTimeout(900);
  // Full now: research holds three graphs and images together.
  await page.locator('[data-tray-kind="graph"]').hover({ force: true });
  await page.waitForTimeout(900);
  await still("full");
  await section(page, "quote-1").locator("[data-remove]").click();
  await page.waitForTimeout(700);
  await page.getByLabel("Finding 2").click();
  await page.locator('[data-tray-kind="quote"]').focus();
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  await still("enter");
});

// The "+" menu on the phone, where there is no tray.
await clip("phone-plus-menu", PHONE, "?sample=research", async ({ page, still }) => {
  const plus = page.getByRole("button", { name: "Add a block before conclusion" });
  await plus.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await plus.tap();
  await page.waitForTimeout(900);
  await still("open");
  await page.locator('.lab-menu [data-insert-kind="quote"]').tap();
  await page.waitForTimeout(900);
  await still("added");
  await section(page, "quote-1").locator("[data-remove]").tap();
  await page.waitForTimeout(800);
});

await browser.close();
console.log(`\n${made.length} videos in ${out}:\n${made.map((f) => `  ${f}`).join("\n")}`);
