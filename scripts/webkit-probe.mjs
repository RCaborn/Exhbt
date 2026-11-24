#!/usr/bin/env node
// What the WebKit that Playwright installs says it is, under the two device profiles the WebKit
// projects use (playwright.config.ts): node scripts/webkit-probe.mjs
// The WebKit job (.github/workflows/webkit.yml) prints it once a run. WebKit on Linux is not Safari on
// a Mac or an iPhone, and this is where to read how far it is from one (a button taking the focus on
// a click, which Safari's never does; the platform the page is told; what CSS and which APIs it has)
// before reading a failure as Safari's. It always exits 0.
import { devices, webkit } from "@playwright/test";

const PAGE = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
<textarea id="t">one two three</textarea><div id="e" contenteditable="true">one two three</div>
<input id="i" value="field"><button id="b" type="button">Button</button>`;

/** Read in the page. */
function read() {
  const mq = (q) => matchMedia(q).matches;
  const css = (p, v) => CSS.supports(p, v);
  const sel = (s) => CSS.supports(`selector(${s})`);
  const has = (v) => typeof v !== "undefined";
  const editable = document.createElement("div");
  editable.contentEditable = "plaintext-only";
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    window: `${innerWidth}x${innerHeight} @${devicePixelRatio}`,
    media: Object.fromEntries(["(pointer: coarse)", "(pointer: fine)", "(hover: none)", "(hover: hover)", "(any-pointer: coarse)", "(any-hover: hover)", "(prefers-reduced-motion: reduce)"].map((q) => [q, mq(q)])),
    touch: { TouchEvent: has(window.TouchEvent), Touch: has(window.Touch), ontouchstart: "ontouchstart" in window, createTouch: typeof document.createTouch },
    css: {
      "field-sizing": css("field-sizing", "content"),
      dvh: css("height", "100dvh"),
      svh: css("height", "100svh"),
      ":has()": sel(":has(a)"),
      ":popover-open": sel(":popover-open"),
      "text-wrap balance": css("text-wrap", "balance"),
      "text-wrap pretty": css("text-wrap", "pretty"),
      "user-select": css("user-select", "none"),
      "-webkit-user-select": css("-webkit-user-select", "none"),
      "-webkit-touch-callout": css("-webkit-touch-callout", "none"),
      "touch-action": css("touch-action", "none"),
      "anchor-name": css("anchor-name", "--a"),
      "overflow clip": css("overflow", "clip"),
      "overscroll-behavior": css("overscroll-behavior", "contain"),
      "scrollbar-gutter": css("scrollbar-gutter", "stable"),
      "color-mix": css("color", "color-mix(in srgb, red, blue)"),
      "interpolate-size": css("interpolate-size", "allow-keywords"),
    },
    api: {
      requestIdleCallback: typeof window.requestIdleCallback,
      scheduler: typeof window.scheduler,
      popover: "popover" in HTMLElement.prototype,
      dialog: has(window.HTMLDialogElement),
      inert: "inert" in HTMLElement.prototype,
      "plaintext-only": editable.contentEditable,
      caretPositionFromPoint: typeof document.caretPositionFromPoint,
      caretRangeFromPoint: typeof document.caretRangeFromPoint,
      clipboard: typeof navigator.clipboard,
      visualViewport: typeof window.visualViewport,
      scrollend: "onscrollend" in window,
      createImageBitmap: typeof window.createImageBitmap,
      OffscreenCanvas: typeof window.OffscreenCanvas,
      "Intl.Segmenter": typeof Intl.Segmenter,
      toSorted: typeof Array.prototype.toSorted,
      "Object.groupBy": typeof Object.groupBy,
      "Promise.withResolvers": typeof Promise.withResolvers,
      "Set.union": typeof Set.prototype.union,
      webp: document.createElement("canvas").toDataURL("image/webp").slice(5, 15),
    },
  };
}

/** What only real input shows: where the focus goes on a click, and what the editing keys do. */
async function act(page) {
  const out = {};
  await page.click("#i");
  await page.click("#b");
  out["the focus after a click on a button"] = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  await page.click("#t");
  await page.keyboard.press("ControlOrMeta+A");
  out["Control+A in a textarea selects"] = await page.evaluate(() => {
    const t = document.querySelector("#t");
    return `${t.selectionStart}-${t.selectionEnd} of ${t.value.length}`;
  });
  await page.keyboard.type("x");
  await page.keyboard.press("ControlOrMeta+z");
  out["then x, then Control+Z leaves"] = await page.evaluate(() => document.querySelector("#t").value);
  await page.click("#e");
  await page.keyboard.press("ControlOrMeta+A");
  out["Control+A in an editable selects"] = await page.evaluate(() => String(getSelection()));
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("!");
  out["Control+End then ! gives"] = await page.evaluate(() => document.querySelector("#e").textContent);
  await page.keyboard.press("Meta+A");
  out["Meta+A in an editable selects"] = await page.evaluate(() => String(getSelection()));
  return out;
}

try {
  const browser = await webkit.launch();
  console.log(`== WebKit probe: WebKit ${browser.version()}`);
  for (const device of ["Desktop Safari", "iPhone 14"]) {
    const context = await browser.newContext({ ...devices[device] });
    const page = await context.newPage();
    await page.setContent(PAGE);
    console.log(`-- as ${device}`);
    console.log(JSON.stringify({ ...(await page.evaluate(read)), input: await act(page) }, null, 1));
    await context.close();
  }
  await browser.close();
} catch (e) {
  console.log(`== WebKit probe failed: ${e?.message ?? e}`);
}
console.log("== end of WebKit probe");
