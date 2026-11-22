// Frame times for the edit-on-page editor (decision 0026, "Smoothness"), with the processor slowed
// through the browser's own throttle. Not a test: it prints a table for the release notes and Rory.
//
//   node scripts/editor-timing.mjs [base URL] [processor slowdown] [runs]
//   node scripts/editor-timing.mjs http://localhost:3213 4 3
//
// It opens G's sign-in-free harness, /dev/editor-timing?sample=gallery (the longest sample), which is
// served in production only by a build run with EXHBT_LAB=1. Run it against a production build:
//
//   npx next build && EXHBT_LAB=1 npx next start -p 3213
//
// (a development build's React is several times slower and says little about what a person would
// feel). EXHBT_LAB is never set anywhere else. It reports, for each run:
//  - the median, 95th centile and longest frame during a scripted mouse drag of the gallery's lead
//    image to the foot of the page (picked up, carried to the bottom edge, held there while the page
//    scrolls itself to the end), and the longest frame at the drop;
//  - keystroke to paint for 40 characters typed into a finding, and whether any other part of the page
//    drew again while they were typed.
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://localhost:3213";
const rate = Number(process.argv[3] || 4);
const runs = Number(process.argv[4] || 3);
const SAMPLE = "gallery";
const READY = '[data-editor="page"][data-ready="true"]';

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const r1 = (n) => Math.round(n * 10) / 10;
const stats = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return s.length ? { n: s.length, median: r1(quantile(s, 0.5)), p95: r1(quantile(s, 0.95)), max: r1(s[s.length - 1]) } : { n: 0, median: 0, p95: 0, max: 0 };
};

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

async function open() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const res = await page.goto(`${base}/dev/editor-timing?sample=${SAMPLE}`, { waitUntil: "networkidle" });
  if (!res || res.status() !== 200) throw new Error(`/dev/editor-timing answered ${res?.status()}: is this a build with EXHBT_LAB=1?`);
  await page.waitForSelector(READY);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((done) => img.addEventListener("load", done, { once: true })))));
  });
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
    let last = performance.now();
    w.__running = true;
    const tick = (t) => {
      w.__frames.push({ at: t, ms: t - last });
      last = t;
      if (w.__running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const mark = (page, name) => page.evaluate((n) => (window.__marks[n] = performance.now()), name);
const stopFrames = (page) =>
  page.evaluate(() => {
    window.__running = false;
    return { frames: window.__frames, marks: window.__marks };
  });

const order = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[data-editor="page"] article [data-section-id]'), (e) => e.dataset.sectionId));

async function drag() {
  const { context, page } = await open();
  const first = (await order(page))[0];
  const frame = page.locator(`${READY} article [data-section-id="${first}"]`);
  await frame.hover();
  const g = await frame.locator("[data-grip]").boundingBox();
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
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(200);
    const now = await page.evaluate(() => window.scrollY);
    if (now === y) break;
    y = now;
  }
  await mark(page, "up");
  await page.mouse.up();
  await page.waitForTimeout(500);
  await mark(page, "end");
  const { frames, marks } = await stopFrames(page);
  const after = await order(page);
  await context.close();
  const during = frames.filter((f) => f.at > marks.down && f.at <= marks.up).map((f) => f.ms);
  const atDrop = frames.filter((f) => f.at > marks.up && f.at <= marks.end).map((f) => f.ms);
  return { seconds: r1((marks.up - marks.down) / 1000), scrolledTo: y, movedTo: after.indexOf(first) + 1, of: after.length, drag: { ...stats(during), over50ms: during.filter((ms) => ms > 50).length }, drop: stats(atDrop) };
}

async function typing() {
  const { context, page } = await open();
  // The findings' first line: a formatted field, which becomes its editor when clicked.
  const finding = page.locator(`${READY} [data-kind="findings"] [data-path$=".items.0"]`).first();
  await finding.scrollIntoViewIfNeeded();
  await finding.click();
  await page.waitForFunction(() => document.activeElement?.closest(".ProseMirror, [contenteditable]") !== null);
  await page.keyboard.press("End");
  const id = await page.evaluate(() => document.activeElement.closest("[data-section-id]").dataset.sectionId);
  const before = await page.evaluate(() => ({ ...(window.__exhbtRenders ?? {}) }));
  await page.evaluate(() => {
    const w = window;
    w.__keys = [];
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
  });
  const text = " and typing goes on here for forty chars";
  for (const ch of text.slice(0, 40)) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(400);
  const { keys, renders } = await page.evaluate(() => ({ keys: window.__keys, renders: { ...(window.__exhbtRenders ?? {}) } }));
  await context.close();
  const others = Object.keys(renders).filter((k) => k !== id && renders[k] !== before[k]);
  return { typed: keys.length, keystrokeToPaint: stats(keys), othersDrawn: others };
}

const out = { base, cpuSlowdown: rate, sample: SAMPLE, browser: browser.version(), drags: [], typing: [] };
for (let i = 0; i < runs; i++) out.drags.push(await drag());
for (let i = 0; i < runs; i++) out.typing.push(await typing());
await browser.close();

console.log(JSON.stringify(out, null, 2));
console.log("");
console.log(`Gallery sample, processor slowed ${rate} times, ${out.browser}. Frame times are the gap between one animation frame and the next.`);
console.log("");
console.log("| Run | Drag: median frame | 95th centile | Longest | Frames over 50ms | Longest at the drop | Keystroke to paint: median | 95th | Longest | Other parts drawn |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (let i = 0; i < runs; i++) {
  const d = out.drags[i];
  const t = out.typing[i];
  console.log(`| ${i + 1} | ${d.drag.median}ms | ${d.drag.p95}ms | ${d.drag.max}ms | ${d.drag.over50ms} | ${d.drop.max}ms | ${t.keystrokeToPaint.median}ms | ${t.keystrokeToPaint.p95}ms | ${t.keystrokeToPaint.max}ms | ${t.othersDrawn.length ? t.othersDrawn.join(", ") : "none"} |`);
}
