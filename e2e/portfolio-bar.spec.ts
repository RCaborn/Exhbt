import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { FULL, fullFixture } from "./fixtures/portfolio-pages";
import { HOME, READY, call, expect, focusedPath, fresh, openEditor, setKind, settle, stateNow, test, valueAt, waitReady, waitSaved } from "./portfolio-editor";

// The portfolio editor's bar and everything it opens (brief G of docs/briefs/portfolio-first; decision
// 0031, "The bar" and "What is edited where"): the chip, Look, See as a visitor, Job links, the menu and
// the primary button; the Look menu; the photo sheet; Suggest an intro and Your links; the address sheet;
// Team; and the first-run strip. Each test is a person of its own: a seeded portfolio (/dev/portfolio-parity),
// or a brand-new person signed in with a fresh email, put on a plan with /dev/plan.

const BAR = `${READY} [data-bar]`;
const bar = (page: Page) => page.locator(BAR);
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Your portfolio" });

/** A brand-new person: no address, no exhbts, on `plan`, in the editor. */
async function newPerson(page: Page, tag: string, plan: "free" | "premium" | "max" = "free") {
  await setKind(page, "page");
  const email = `pe-new-${tag}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const next = plan === "free" ? "/portfolio" : `/dev/plan?plan=${plan}&next=${encodeURIComponent("/portfolio")}`;
  await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  await waitReady(page);
}

/**
 * Each piece of text inside `sel` whose contrast with the nearest opaque background among its ancestors is
 * under WCAG AA (4.5:1, or 3:1 from 24px, or 18.66px bold). Placeholders are left out, as axe leaves them out.
 */
async function lowContrast(page: Page, sel: string): Promise<string[]> {
  return page.locator(sel).evaluate((root) => {
    const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number) as number[];
    const lum = ([r, g, b]: number[]) =>
      [r!, g!, b!].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const background = (el: Element): number[] => {
      for (let at: Element | null = el; at; at = at.parentElement) {
        const c = rgba(getComputedStyle(at).backgroundColor);
        if (c.length >= 3 && (c[3] ?? 1) >= 1) return c;
      }
      return [255, 255, 255];
    };
    const out: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || el.closest("[aria-hidden=true]")) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || el.getClientRects().length === 0) continue;
      const fg = rgba(s.color);
      const bg = background(el);
      const a = fg[3] ?? 1;
      const seen = [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a));
      const [hi, lo] = [lum(seen), lum(bg)].sort((x, y) => y - x);
      const ratio = (hi! + 0.05) / (lo! + 0.05);
      const px = parseFloat(s.fontSize);
      const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) out.push(`${n.textContent.trim()}: ${ratio.toFixed(2)}`);
    }
    return out;
  });
}

/**
 * The words on the page the tool's button meets, measured apart from the code that places it: text by its
 * Range; a field's words with a canvas in the field's own type, wrapped word by word in its box.
 */
function coveredWords(t: Element): string[] {
  const b = t.querySelector("button")!.getBoundingClientRect();
  const meets = (r: DOMRect) => r.width > 0 && r.height > 0 && r.left < b.right - 1 && r.right > b.left + 1 && r.top < b.bottom - 1 && r.bottom > b.top + 1;
  const home = t.closest("[data-portfolio-home]")!;
  const out: string[] = [];
  const walker = document.createTreeWalker(home, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent?.trim() || t.contains(n) || el.closest("[data-tools], .pe-photo-button, [aria-hidden=true], .sr-only, textarea")) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    if ([...r.getClientRects()].some(meets)) out.push(`"${n.textContent.trim().slice(0, 24)}"`);
  }
  for (const f of home.querySelectorAll<HTMLTextAreaElement>("textarea")) {
    const text = f.value || f.placeholder;
    if (!text.trim()) continue;
    const s = getComputedStyle(f);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = s.font;
    const box = f.getBoundingClientRect();
    const padL = parseFloat(s.paddingLeft);
    const room = box.width - padL - parseFloat(s.paddingRight);
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
    const lines: number[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const longer = line ? `${line} ${word}` : word;
      if (ctx.measureText(longer).width > room && line) {
        lines.push(ctx.measureText(line).width);
        line = word;
      } else line = longer;
    }
    if (line) lines.push(ctx.measureText(line).width);
    lines.forEach((w, i) => {
      const left = s.textAlign === "right" || s.textAlign === "end" ? box.right - parseFloat(s.paddingRight) - w : s.textAlign === "center" ? box.left + (box.width - w) / 2 : box.left + padL;
      if (meets(new DOMRect(left, box.top + parseFloat(s.paddingTop) + i * lh, w, lh))) out.push(`${f.getAttribute("aria-label")}, line ${i + 1}`);
    });
  }
  return out;
}

test.describe("The bar", () => {
  test("at 1440 the row holds every part, and the chip says the page is live", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page, fresh(FULL, "bar-wide"));
    await expect(bar(page).getByRole("heading", { level: 2, name: "Your portfolio" })).toBeVisible();
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "live");
    await expect(bar(page).locator("[data-chip]")).toContainText("Live");
    const t = toolbar(page);
    for (const name of ["Look", "Undo", "See as a visitor", "Job links", "More", "Share"]) await expect(t.getByRole("button", { name, exact: true })).toBeVisible();
    // The toolbar holds controls only: the heading sits before it, and is not a Tab stop.
    await expect(t.getByRole("heading")).toHaveCount(0);
    await expect(bar(page).getByRole("heading", { level: 2, name: "Your portfolio", exact: true })).toHaveAttribute("tabindex", "-1");
    // The bar is exactly as tall as the exhbt editor's, and stays at the top while the page scrolls.
    const h = await bar(page).evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBe(56);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => bar(page).evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  });

  test("on a phone the chip keeps a word, never the dot alone, and the row fits", async ({ page }) => {
    await newPerson(page, "chip-phone", "premium");
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      const chip = bar(page).locator("[data-chip]");
      await expect(chip).toHaveAttribute("data-chip", "offline");
      await expect(chip.locator(".pe-status-short")).toBeVisible();
      await expect(chip.locator(".pe-status-short")).toHaveText("Not live");
      await expect(bar(page).getByRole("heading", { level: 2, name: "Your portfolio", exact: true })).toBeAttached();
      const primary = toolbar(page).getByRole("button", { name: "Claim your address" });
      await expect(primary).toBeInViewport({ ratio: 1 });
      // Nothing in the row is cut off or pushed past the window's edge.
      expect(await bar(page).evaluate((el) => [...el.querySelectorAll("button, [data-chip], [data-save]")].every((n) => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; })), `at ${width}`).toBe(true);
      const chipBox = (await chip.boundingBox())!;
      const primaryBox = (await primary.boundingBox())!;
      expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(primaryBox.x);
    }
  });

  test("at 700 Look, Undo, See as a visitor and Job links fold into the menu", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await openEditor(page, fresh(FULL, "bar-narrow"));
    const t = toolbar(page);
    await expect(t.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(bar(page).locator("[data-save]")).toBeVisible();
    for (const name of ["Look", "Undo", "See as a visitor", "Job links"]) await expect(t.getByRole("button", { name, exact: true })).toHaveCount(0);
    await t.getByRole("button", { name: "More" }).click();
    const menu = page.getByRole("menu");
    for (const name of ["Undo", "Look", "See as a visitor", "Job links", "Team projects", "Use the step builder"]) await expect(menu.getByRole("menuitem", { name })).toBeVisible();
    // Look from the menu is a sheet, and choosing a look there applies it.
    await menu.getByRole("menuitem", { name: "Look" }).click();
    const sheet = page.locator('[data-sheet="look"]');
    await expect(sheet.getByRole("radio", { name: /Night/ })).toBeVisible();
    await sheet.getByRole("radio", { name: /Night/ }).check();
    await expect.poll(() => valueAt(page, "arrangement.themeId")).toBe("night");
  });

  test("See as a visitor turns the visitor's view on and off", async ({ page }) => {
    await openEditor(page, fresh(FULL, "bar-visitor"));
    const toggle = toolbar(page).getByRole("button", { name: "See as a visitor" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => window.__portfolioEditor!.ui().visitor)).toBe(true);
    await toggle.click();
    await expect.poll(() => page.evaluate(() => window.__portfolioEditor!.ui().visitor)).toBe(false);
  });

  test("the chip says Preview only on Free, and Not online yet with no address or nothing live", async ({ page }) => {
    await newPerson(page, "chip-free");
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "preview");
    await expect(bar(page).locator("[data-chip]")).toContainText("Preview only");
    await expect(toolbar(page).getByRole("button", { name: "Claim your address" })).toBeVisible();
  });

  test("on a paid plan with no address the chip says Not online yet, and the primary button claims one", async ({ page }) => {
    await newPerson(page, "chip-paid", "premium");
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "offline");
    await expect(bar(page).locator("[data-chip]")).toContainText("Not online yet");
  });

  test("with an address and every exhbt hidden, the page is not online", async ({ page }) => {
    const f = fresh({ ...fullFixture("x", null, "max"), exhbts: fullFixture("x", null).exhbts.map((e) => ({ ...e, hidden: true })) }, "chip-hidden");
    await openEditor(page, f);
    await expect(bar(page).locator("[data-chip]")).toHaveAttribute("data-chip", "offline");
  });
});

test.describe("The Look menu", () => {
  test("each open look applies at once, is saved, and Undo names it", async ({ page }) => {
    await openEditor(page, fresh(FULL, "look-open"));
    await toolbar(page).getByRole("button", { name: "Look" }).click();
    const menu = page.locator("[data-look-menu]");
    await expect(menu).toBeVisible();
    // A list: each look by name, with its faces named.
    await expect(menu.getByRole("radio")).toHaveCount(8);
    await expect(menu).toContainText("Bricolage Grotesque");
    for (const [name, id] of [
      [/Night/, "night"],
      [/Mono/, "mono"],
      [/Classic/, "classic"],
    ] as const) {
      await menu.getByRole("radio", { name }).check();
      await expect.poll(() => valueAt(page, "arrangement.themeId")).toBe(id);
      await expect(page.locator(`${READY} [data-portfolio-home]`)).toHaveAttribute("data-look", id);
    }
    await expect(page.locator(`${READY} #pe-undo`)).toHaveAccessibleName(/Undo: changed the look to Classic/);
    // A colourway is a swatch under its look.
    await menu.locator('[data-variant-option="classic-burgundy"] input').check();
    await expect.poll(() => valueAt(page, "arrangement.themeId")).toBe("classic-burgundy");
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect((await stateNow(page)).arrangement.themeId).toBe("classic-burgundy");
  });

  test("a locked look previews under a line, is never saved, and is not what a visitor sees", async ({ page }) => {
    await openEditor(page, fresh({ ...fullFixture("x", null, "premium") }, "look-locked"));
    await toolbar(page).getByRole("button", { name: "Look" }).click();
    const menu = page.locator("[data-look-menu]");
    const locked = menu.locator('[data-locked="true"]').first();
    // Premium has some of the looks, not all (themeAllowance).
    await expect(locked).toBeVisible();
    const look = await locked.getAttribute("data-look-option");
    await locked.getByRole("radio").check();
    await expect(page.locator(`${READY} [data-portfolio-home]`)).toHaveAttribute("data-look", look!);
    const line = page.locator("[data-look-preview]");
    await expect(line).toContainText(/Preview of .+, comes with/);
    await expect(line.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/account/billing");
    expect(await valueAt(page, "arrangement.themeId")).toBe("exhbt");
    await page.keyboard.press("Escape");
    await line.getByRole("button", { name: "Back to yours" }).click();
    await expect(line).toHaveCount(0);
    await expect(page.locator(`${READY} [data-portfolio-home]`)).toHaveAttribute("data-look", "exhbt");
  });
});

test.describe("The first minute", () => {
  test("a new person sees the strip, each item goes to its field, and ticks as it is done", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await newPerson(page, "first");
    const strip = page.locator('[data-first-run="wide"]');
    await expect(strip).toBeVisible();
    await expect(strip.getByRole("heading", { name: "Your portfolio in three steps" })).toBeVisible();
    // Three steps, the first already done: signing up was it.
    for (const name of ["Account", "Your portfolio", "Your first exhbt"]) await expect(strip).toContainText(name);
    await expect(strip).toHaveAttribute("data-step", "page");
    await strip.getByRole("button", { name: /^One line about you/ }).click();
    await expect.poll(() => focusedPath(page)).toBe("profile.headline");
    await page.keyboard.type("Data analyst in training");
    await expect(strip.locator('[data-todo="headline"]')).toHaveAttribute("data-done", "true");
    await strip.getByRole("button", { name: /^Pick a look/ }).click();
    await expect(page.locator("[data-look-menu]")).toBeVisible();
    // Free has one look: looking through them, and keeping it, is the choice.
    await page.keyboard.press("Escape");
    await expect(strip.locator('[data-todo="look"]')).toHaveAttribute("data-done", "true");
    // Skip goes straight to the second step.
    await strip.getByRole("button", { name: "Skip to your first exhbt" }).click();
    await expect(strip).toHaveAttribute("data-step", "exhbt");
    // Hide keeps it hidden on the next visit.
    await strip.getByRole("button", { name: "Hide this" }).click();
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
    await page.reload();
    await waitReady(page);
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
  });

  test("once hidden, the strip is in its cookie, so neither the loading view nor the editor draws it, and nothing moves", async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Another account's "Hide this" in the same browser hides nothing of this person's.
    await context.addCookies([{ name: "exhbt_strip_hidden", value: "someone-else", url: "http://localhost" }]);
    await newPerson(page, "strip-cookie", "premium");
    await expect(page.locator('[data-first-run="wide"]')).toBeVisible();
    await page.locator("[data-first-run]").getByRole("button", { name: "Hide this" }).click();
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
    const cookie = (await context.cookies()).find((c) => c.name === "exhbt_strip_hidden");
    expect(cookie?.value).not.toBe("someone-else");
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(360 * 24 * 3600);
    // The next visit, with the editor's chunk held back as a slow connection holds it.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(/PortfolioEditor/, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/portfolio");
    const loading = page.locator('[data-editor="portfolio"][data-loading]');
    await expect(loading.locator(HOME)).toBeVisible();
    await expect(page.locator("[data-first-run-stand-in]")).toHaveCount(0);
    await settle(page);
    const top = () => page.locator(HOME).first().evaluate((el) => el.getBoundingClientRect().y + window.scrollY);
    const before = await top();
    release();
    await waitReady(page);
    await settle(page);
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
    expect(await top()).toBe(before);
  });

  test("someone with a name, a headline, a look of their own and exhbts sees no strip", async ({ page }) => {
    await openEditor(page, fresh(fullFixture("x", "classic"), "first-done"));
    await expect(page.locator("[data-first-run]")).toHaveCount(0);
  });

  test("on a narrow window the strip is one line with Next", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await newPerson(page, "first-narrow");
    const strip = page.locator('[data-first-run="narrow"]');
    await expect(strip).toContainText("Step 2 of 3");
    await strip.getByRole("button", { name: /^Next/ }).click();
    await expect.poll(() => focusedPath(page)).toBe("profile.name");
  });
});

/** A small PNG drawn in the page, for the photo. */
async function png(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 300;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4fe9b4";
    ctx.fillRect(0, 0, 300, 300);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(b64, "base64");
}

test.describe("On the page", () => {
  test("the photo button opens the photo sheet, which adds and removes the photo", async ({ page }) => {
    await newPerson(page, "photo", "premium");
    const button = page.locator(`${READY} [data-photo-button]`).getByRole("button", { name: "Add a photo" });
    await expect(button).toBeVisible();
    await button.click();
    const sheet = page.locator('[data-sheet="photo"]');
    await expect(sheet.getByRole("heading", { name: "Add a photo" })).toBeVisible();
    await sheet.getByTestId("photo-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: await png(page) });
    await expect(sheet.getByRole("status").filter({ hasText: "Photo saved." })).toBeVisible();
    await expect(page.locator(`${READY} [data-portfolio-home] [data-avatar="photo"]`).first()).toBeVisible();
    await expect(page.locator(`${READY} [data-photo-button]`).getByRole("button", { name: "Change your photo" })).toBeAttached();
    await sheet.getByRole("button", { name: "Remove photo" }).click();
    await expect(sheet.getByRole("status").filter({ hasText: "Photo removed." })).toBeVisible();
    await expect(page.locator(`${READY} [data-portfolio-home] [data-avatar="initials"]`).first()).toBeVisible();
  });

  test("Suggest an intro covers no word of the headline: on an empty intro, and once it has words", async ({ page }) => {
    await newPerson(page, "intro-place", "premium");
    await call(page, "setAt", "profile.headline", "Final-year Economics student at Leeds, into data analysis and public policy");
    const tool = page.locator(`${READY} [data-tools="intro"]`);
    /** Whether the button's box meets the headline's field (its words fill it: the headline is long enough to). */
    const onHeadline = () =>
      tool.evaluate((t) => {
        const b = t.querySelector("button")!.getBoundingClientRect();
        const r = document.querySelector('[data-editor="portfolio"][data-ready] [data-path="profile.headline"]')!.getBoundingClientRect();
        return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.mouse.move(0, 0);
      await expect(tool.getByRole("button", { name: "Suggest an intro" })).toBeVisible();
      expect(await onHeadline(), `empty intro at ${width}`).toBe(false);
    }
    // With words, it is above the intro, on the headline's line, so it is seen only while the intro is pointed at or edited.
    await call(page, "setAt", "profile.bio", "I study economics at Leeds and turn public data into charts people read.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.mouse.move(0, 0);
    await expect(tool).toHaveCSS("opacity", "0");
    await page.locator(`${READY} [data-intro]`).first().hover();
    await expect(tool).toHaveCSS("opacity", "1");
  });

  test("Suggest an intro covers no word in any of the eight looks, at 1440 and 390, empty and filled", async ({ page }) => {
    test.setTimeout(240_000);
    await newPerson(page, "intro-looks", "max");
    await call(page, "setAt", "profile.name", "Maya Clarke");
    await call(page, "setAt", "profile.headline", "Final-year Economics student at Leeds, into data analysis and public policy");
    await call(page, "setAt", "profile.location", "Leeds");
    await call(page, "setAt", "profile.lookingFor", "Graduate data roles in the public sector");
    const tool = page.locator(`${READY} [data-tools="intro"]`);
    const missed: string[] = [];
    for (const filled of [false, true]) {
      await call(page, "setAt", "profile.bio", filled ? "I study economics at Leeds and like turning messy public data into clear charts that people actually read. Last year I built a dashboard of bus delays." : "");
      for (const id of PORTFOLIO_THEMES.map((t) => t.id)) {
        await call(page, "setAt", "arrangement.themeId", id);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await tool.scrollIntoViewIfNeeded();
          // Filled, it shows while the intro is pointed at; empty, it is always there.
          if (filled) await page.locator(`${READY} [data-intro]`).first().hover({ position: { x: 10, y: 10 } });
          else await page.mouse.move(0, 0);
          await expect(tool.getByRole("button", { name: "Suggest an intro" })).toBeVisible();
          await page.waitForTimeout(150);
          const hits = await tool.evaluate(coveredWords);
          if (hits.length) missed.push(`${filled ? "filled" : "empty"} ${id} at ${width}: ${hits.join(", ")}`);
        }
      }
    }
    expect(missed).toEqual([]);
  });

  test("while the intro is typed, key by key, Suggest an intro never covers its words: it is hidden until it is placed again", async ({ page }) => {
    await newPerson(page, "intro-typing", "premium");
    await call(page, "setAt", "profile.headline", "Final-year Economics student at Leeds, into data analysis and public policy");
    const tool = page.locator(`${READY} [data-tools="intro"]`);
    const words = "I study economics at Leeds and like turning messy public data into clear charts that people read.";
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await call(page, "setAt", "profile.bio", "");
      const intro = page.locator(`${READY} [data-path="profile.bio"] textarea[data-para]`).first();
      await intro.scrollIntoViewIfNeeded();
      await intro.click();
      const missed: string[] = [];
      for (const key of words) {
        await page.keyboard.type(key);
        // Seen, it covers no word; hidden (data-typing), it may sit anywhere.
        const hits = await tool.evaluate((t, covered) => (getComputedStyle(t).visibility === "hidden" ? [] : (new Function(`return (${covered})`)() as (t: Element) => string[])(t)), coveredWords.toString());
        if (hits.length) missed.push(`after "${key}" at ${width}: ${hits.join(", ")}`);
      }
      expect(missed).toEqual([]);
      // Once typing pauses it is placed for the words and shown again, still covering none.
      await expect(tool).not.toHaveAttribute("data-typing");
      await expect.poll(() => tool.evaluate((t) => getComputedStyle(t).visibility)).toBe("visible");
      expect(await tool.evaluate(coveredWords), `placed at ${width}`).toEqual([]);
    }
  });

  test("Suggest an intro fills the intro from the stand-in, and Undo takes it back", async ({ page }) => {
    await openEditor(page, fresh(FULL, "intro"));
    const before = await valueAt(page, "profile.bio");
    await page.locator(`${READY} [data-tools="intro"]`).getByRole("button", { name: "Suggest an intro" }).click();
    await expect(page.locator("[data-intro-note]")).toContainText("written only from what you’ve told us");
    await expect.poll(() => valueAt(page, "profile.bio")).not.toBe(before);
    await expect(page.locator(`${READY} #pe-undo`)).toHaveAccessibleName("Undo: suggested an intro");
    await waitSaved(page);
    await page.locator(`${READY} #pe-undo`).click();
    await expect.poll(() => valueAt(page, "profile.bio")).toBe(before);
  });

  test("Your links saves each link, shows its problem, and turns LinkedIn on and off", async ({ page }) => {
    await openEditor(page, fresh(FULL, "links"));
    await page.locator(`${READY} [data-tools="contact"]`).getByRole("button", { name: "Your links" }).click();
    const panel = page.locator("[data-links-panel]");
    await expect(panel).toBeVisible();
    const github = panel.getByRole("textbox", { name: /GitHub/ });
    await github.fill("github.com/maya-new");
    await expect.poll(() => valueAt(page, "profile.github")).toBe("github.com/maya-new");
    await waitSaved(page);
    // A link the rules refuse shows its problem at the field, and is not saved.
    await panel.getByRole("textbox", { name: /Email/ }).fill("not an email");
    await expect(panel.locator('[data-path="profile.contactEmail"]')).toContainText(/email/i);
    await expect(page.locator(`${READY} [data-save]`)).toHaveAttribute("data-save", "invalid");
    await panel.getByRole("textbox", { name: /Email/ }).fill("maya@example.com");
    await waitSaved(page);
    const show = panel.getByRole("switch", { name: "Show LinkedIn on your portfolio" });
    const was = await show.isChecked();
    await show.click();
    await expect.poll(() => valueAt(page, "arrangement.header.linkedin")).toBe(!was);
  });
});

test.describe("The address sheet", () => {
  test("on Free it says what a paid plan gives, with the upgrade", async ({ page }) => {
    await newPerson(page, "addr-free");
    await toolbar(page).getByRole("button", { name: "Claim your address" }).click();
    const sheet = page.locator('[data-sheet="address"]');
    await expect(sheet.locator('[data-address="blocked"]')).toBeVisible();
    await expect(sheet).toContainText("a preview only you can see");
    await expect(sheet.getByTestId("upgrade-prompt")).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "Username" })).toHaveCount(0);
  });

  test("on Premium with no address it claims one, and the sheet turns to Share", async ({ page }) => {
    await newPerson(page, "addr-claim", "premium");
    await toolbar(page).getByRole("button", { name: "Claim your address" }).click();
    const sheet = page.locator('[data-sheet="address"]');
    await expect(sheet.locator('[data-address="claim"]')).toBeVisible();
    await expect(sheet.getByTestId("publish-checklist")).toContainText("Choose your address");
    const name = `pe-claim-${Math.random().toString(36).slice(2, 8)}`;
    await sheet.getByRole("textbox", { name: "Username" }).fill(name);
    await expect(sheet.getByText("Available.")).toBeVisible();
    await sheet.getByRole("button", { name: "Claim username" }).click();
    await expect(sheet.locator('[data-address="share"]')).toBeVisible();
    await expect(sheet.locator("[data-address-host]")).toContainText(name);
    // Nothing is live yet, so the address says not found until there is.
    await expect(sheet).toContainText("shows “not found” until you publish an exhbt");
    await expect(toolbar(page).getByRole("button", { name: "Share" })).toBeVisible();
  });

  test("with an address: Copy link, Change and Hide from search", async ({ page, browserName }) => {
    await openEditor(page, fresh(fullFixture("x", null, "premium"), "addr-share"));
    await toolbar(page).getByRole("button", { name: "Share" }).click();
    const sheet = page.locator('[data-sheet="address"]');
    await expect(sheet.locator('[data-address="share"]')).toBeVisible();
    // Chromium writes and reads the clipboard only with both permissions. WebKit has no clipboard-write (Playwright
    // throws "Unknown permission" for it): a press writes there with none, and clipboard-read lets a test read it back.
    await page.context().grantPermissions(browserName === "webkit" ? ["clipboard-read"] : ["clipboard-read", "clipboard-write"]);
    await sheet.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByText("Link copied", { exact: true }).first()).toBeVisible();
    // What was copied is the address the sheet links to, made whole with this site's origin, wherever the browser lets
    // a test read the clipboard back: Chromium must; a WebKit that refuses the read is noted on the test.
    const href = (await sheet.locator("[data-address-host] a").getAttribute("href")) ?? "";
    expect(href, "the sheet links to the address").not.toBe("");
    const copied = await page.evaluate(() => navigator.clipboard.readText().catch((e: unknown) => ({ refused: String(e) })));
    if (typeof copied === "string") expect(copied).toBe(href.startsWith("/") ? `${new URL(page.url()).origin}${href}` : href);
    else {
      expect(browserName, `the clipboard could not be read: ${copied.refused}`).toBe("webkit");
      test.info().annotations.push({ type: "clipboard", description: `WebKit did not let the test read the clipboard: ${copied.refused}` });
    }
    await sheet.getByRole("button", { name: "Change" }).click();
    await expect(sheet.getByRole("textbox", { name: "Username" })).toBeVisible();
    await expect(sheet).toContainText("redirects to the new one for 30 days");
    const hide = sheet.getByRole("switch", { name: "Hide from search" });
    await hide.click();
    await expect.poll(() => valueAt(page, "profile.hideFromSearch")).toBe(true);
    await waitSaved(page);
  });
});

test.describe("Job links and Team", () => {
  test("Job links on Max with links: each link with Live, its views and Edit, then New job link and the links left", async ({ page }) => {
    const f = fresh({ ...FULL, jobLinks: [{ slug: "northfield-analyst", company: "Northfield Foods", roleTitle: "Graduate Operations Analyst", picks: [{ exhbt: "queue", reason: "A timed trial." }] }] }, "joblinks");
    await openEditor(page, f);
    await toolbar(page).getByRole("button", { name: "Job links" }).click();
    const menu = page.locator("[data-job-links-menu]");
    await expect(menu.locator('[data-job-links="list"]')).toBeVisible();
    await expect(menu).toContainText("Northfield Foods · Graduate Operations Analyst");
    await expect(menu).toContainText("Live");
    await expect(menu).toContainText(/0 views/);
    await expect(menu.getByRole("link", { name: "Edit Northfield Foods · Graduate Operations Analyst" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "New job link" })).toHaveAttribute("href", "/job-links/new");
    await expect(menu).toContainText(/\d+ of \d+ live links left/);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("Job links on Max with none published says to publish first; on Premium, the upgrade line only", async ({ page }) => {
    await newPerson(page, "jl-none", "max");
    await toolbar(page).getByRole("button", { name: "Job links" }).click();
    await expect(page.locator("[data-job-links-menu]")).toContainText("Publish an exhbt first: a job link shows your live exhbts.");
    await page.keyboard.press("Escape");
    await openEditor(page, fresh(fullFixture("x", null, "premium"), "jl-prem"));
    await toolbar(page).getByRole("button", { name: "Job links" }).click();
    const menu = page.locator("[data-job-links-menu]");
    await expect(menu.locator('[data-job-links="upgrade"]')).toBeVisible();
    await expect(menu.getByTestId("upgrade-prompt")).toBeVisible();
    await expect(menu.getByRole("link", { name: "New job link" })).toHaveCount(0);
  });

  test("?open= opens each part once the page is up, and leaves the address", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "openq"), { query: "?open=look" });
    void seeded;
    await expect(page.locator("[data-look-menu]")).toBeVisible();
    await expect(page).toHaveURL(/\/portfolio$/);
    for (const [q, sel] of [
      ["?open=address", '[data-sheet="address"] [data-address]'],
      ["?open=job-links", "[data-job-links-menu]"],
      ["?open=team", "[data-team-sheet]"],
      ["?open=links", "[data-links-panel]"],
      ["#job-links", "[data-job-links-menu]"],
    ] as const) {
      // From another page, as a link in an email arrives: a hash alone on the same page would not load it again.
      await page.goto("about:blank");
      await page.goto(`/portfolio${q}`);
      await waitReady(page);
      await expect(page.locator(sel)).toBeVisible();
    }
  });

  test("Team projects from the menu opens the Team sheet, with what team projects are", async ({ page }) => {
    await openEditor(page, fresh(FULL, "team"));
    await toolbar(page).getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Team projects" }).click();
    const sheet = page.locator('[data-sheet="team"]');
    await expect(sheet.getByRole("heading", { name: "Team projects" }).first()).toBeVisible();
    await expect(sheet).toContainText("each of you can have an exhbt of it");
  });

  test("each part opens by name, as the address's ?open= will open it", async ({ page }) => {
    await openEditor(page, fresh(FULL, "open"));
    for (const [name, sel] of [
      ["look", "[data-look-menu]"],
      ["address", '[data-sheet="address"] [data-address]'],
      ["job-links", "[data-job-links-menu]"],
      ["team", "[data-team-sheet]"],
      ["links", "[data-links-panel]"],
    ] as const) {
      await call(page, "open", name);
      await expect(page.locator(sel)).toBeVisible();
      await call(page, "close");
      await expect(page.locator(sel)).toBeHidden();
    }
  });
});

test.describe("Accessibility", () => {
  test("axe finds nothing with the strip, and with each menu and sheet open", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await newPerson(page, "axe", "premium");
    const check = async (where: string, topLayer?: string) => {
      const axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
      // axe (4.14) does not know the top layer: it stacks a popover by its place in the markup, so a popover
      // drawn over the site's dark footer (Your links, under Get in touch) is measured against the footer.
      // There the contrast is measured here instead, against the popover's own surface, to the same 4.5:1.
      const { violations } = await (topLayer ? axe.disableRules(["color-contrast"]) : axe).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), where).toEqual([]);
      if (topLayer) expect(await lowContrast(page, topLayer), `${where}: contrast on its own surface`).toEqual([]);
    };
    await expect(page.locator('[data-first-run="wide"]')).toBeVisible();
    await check("the first-run strip");
    for (const [name, sel] of [
      ["look", "[data-look-menu]"],
      ["address", '[data-sheet="address"] [data-address]'],
      ["photo", "[data-photo-sheet]"],
      ["job-links", "[data-job-links-menu]"],
      ["team", "[data-team-sheet]"],
      ["links", "[data-links-panel]"],
    ] as const) {
      await call(page, "open", name);
      await expect(page.locator(sel)).toBeVisible();
      await check(`the ${name} menu or sheet`, name === "links" ? sel : undefined);
      await call(page, "close");
      await expect(page.locator(sel)).toBeHidden();
    }
  });
});
