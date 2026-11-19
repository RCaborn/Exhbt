// Timing for the editor lab (/lab/editor), with the CPU slowed four times through the browser's
// own throttle. Not a test: it prints numbers for docs/briefs/edit-on-page/drag-prototype.md.
//
//   node scripts/lab-timing.mjs [base URL] [CPU slowdown]
//   node scripts/lab-timing.mjs http://localhost:3213 4
//
// Run it against a production build (next build, then EXHBT_LAB=1 next start): a development
// build's React is several times slower and says little about what a person would feel.
//
// It reports, on the longest sample (the gallery):
//  - for each version, the longest frame during a scripted mouse drag down the page (pick up the
//    first section, carry it to the bottom edge, let the page scroll itself to the end, drop);
//  - keystroke-to-paint times while typing 40 characters into a finding.
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://localhost:3213";
const rate = Number(process.argv[3] || 4);
const SAMPLE = "gallery";

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const stats = (list) => {
  const s = [...list].sort((a, b) => a - b);
  const r = (n) => Math.round(n * 10) / 10;
  return { n: s.length, median: r(quantile(s, 0.5)), p95: r(quantile(s, 0.95)), max: r(s[s.length - 1]) };
};

const browser = await chromium.launch();

async function open(query) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/lab/editor?sample=${SAMPLE}${query}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-lab][data-ready]");
  await page.waitForSelector('[data-lab-context="field"]');
  await page.evaluate(() => document.fonts.ready);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.waitForTimeout(500);
  return { context, page };
}

/** Frame times, measured in the page: the gap between one animation frame and the next. */
const startFrames = (page) =>
  page.evaluate(() => {
    const w = window;
    w.__frames = [];
    w.__marks = {};
    w.__long = [];
    let last = performance.now();
    w.__running = true;
    const tick = (t) => {
      w.__frames.push({ at: t, ms: t - last });
      last = t;
      if (w.__running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push({ at: e.startTime, ms: e.duration, blocking: e.blockingDuration });
      }).observe({ type: "long-animation-frame", buffered: false });
    } catch {
      // Older browsers have no long-animation-frame entries; the frame gaps above are enough.
    }
  });
const mark = (page, name) => page.evaluate((n) => (window.__marks[n] = performance.now()), name);
const stopFrames = (page) =>
  page.evaluate(() => {
    window.__running = false;
    return { frames: window.__frames, marks: window.__marks, long: window.__long };
  });

async function drag(version) {
  const { context, page } = await open(`&v=${version}`);
  const grip = page.locator('[data-lab-rows] [data-lab-section="image-1"] [data-grip]');
  await grip.scrollIntoViewIfNeeded();
  const g = await grip.boundingBox();
  const from = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  await page.mouse.move(from.x, from.y);
  await startFrames(page);
  await page.waitForTimeout(200);
  await mark(page, "down");
  await page.mouse.down();
  // Down the page at about 500px a second, to just above the bottom edge.
  const to = { x: from.x - 300, y: 888 };
  const steps = Math.ceil((to.y - from.y) / 8);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.waitForTimeout(16);
  }
  // Held at the edge: the page scrolls itself to the end, and the place changes under the still pointer.
  let y = -1;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(200);
    const now = await page.evaluate(() => window.scrollY);
    if (now === y) break;
    y = now;
  }
  await mark(page, "up");
  await page.mouse.up();
  await page.waitForTimeout(500);
  await mark(page, "end");
  const { frames, marks, long } = await stopFrames(page);
  const order = await page.evaluate(() => Array.from(document.querySelectorAll("[data-lab-rows] [data-lab-section]"), (e) => e.dataset.labSection));
  await context.close();
  const during = frames.filter((f) => f.at > marks.down && f.at <= marks.up).map((f) => f.ms);
  const atDrop = frames.filter((f) => f.at > marks.up && f.at <= marks.end).map((f) => f.ms);
  return {
    version,
    seconds: Math.round((marks.up - marks.down) / 100) / 10,
    scrolledTo: y,
    movedTo: order.indexOf("image-1") + 1,
    drag: { ...stats(during), over50ms: during.filter((ms) => ms > 50).length },
    drop: stats(atDrop),
    longFrames: long.filter((l) => l.at > marks.down && l.at <= marks.end).map((l) => Math.round(l.ms)),
  };
}

async function typing() {
  const { context, page } = await open("&v=a");
  const field = page.locator('[data-lab-rows] [data-lab-section="findings"] textarea').first();
  await field.scrollIntoViewIfNeeded();
  await field.click();
  await page.keyboard.press("End");
  await page.evaluate(() => {
    const w = window;
    w.__keys = [];
    w.__events = [];
    // From the key going down to just after the next frame has been drawn.
    window.addEventListener(
      "keydown",
      () => {
        const t0 = performance.now();
        requestAnimationFrame(() => {
          const ch = new MessageChannel();
          ch.port1.onmessage = () => w.__keys.push(performance.now() - t0);
          ch.port2.postMessage(0);
        });
      },
      true,
    );
    // The browser's own measure of the same thing (Event Timing), in 8ms steps.
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (e.name === "keydown" || e.name === "input") w.__events.push({ name: e.name, ms: e.duration });
      }).observe({ type: "event", durationThreshold: 16, buffered: false });
    } catch {
      // No Event Timing: the measure above stands alone.
    }
  });
  const text = " and typing goes on here for forty chars";
  for (const ch of text.slice(0, 40)) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(400);
  const { keys, events, renders, value } = await page.evaluate(() => ({ keys: window.__keys, events: window.__events, renders: window.__labRenders, value: document.activeElement.value }));
  await context.close();
  const input = events.filter((e) => e.name === "input").map((e) => e.ms);
  return { typed: keys.length, endsWith: value.slice(-12), keystrokeToPaint: stats(keys), eventTimingInput: input.length ? stats(input) : null, rendersOfOtherSections: Object.entries(renders).filter(([k, n]) => k !== "findings" && n > 2).length };
}

const out = { base, cpuSlowdown: rate, sample: SAMPLE, browser: browser.version(), drags: [], typing: null };
for (const v of ["mix", "a", "b"]) out.drags.push(await drag(v));
out.typing = await typing();
await browser.close();

console.log(JSON.stringify(out, null, 2));
console.log("");
for (const d of out.drags) {
  console.log(`Version ${d.version.toUpperCase()} drag (${d.seconds}s, ${d.drag.n} frames): longest frame ${d.drag.max}ms, 95th ${d.drag.p95}ms, median ${d.drag.median}ms, ${d.drag.over50ms} over 50ms. At the drop: longest ${d.drop.max}ms.`);
}
console.log(`Typing ${out.typing.typed} characters: keystroke to paint median ${out.typing.keystrokeToPaint.median}ms, 95th ${out.typing.keystrokeToPaint.p95}ms, longest ${out.typing.keystrokeToPaint.max}ms.`);
