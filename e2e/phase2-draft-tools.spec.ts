import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS } from "../lib/entitlements";
import { emptyDoc, text, type ExhbtDoc, type RichText } from "../lib/exhbt/blocks";
import { aiVersionOf, blockValue, replaceBlock, sameBlock } from "../lib/exhbt/draft-blocks";
import { PORTFOLIO_THEMES } from "../lib/portfolio-themes";
import { DRAFT_WITH_AI, startBlank } from "./add-exhbt";
import { backToAiVersion, cardMenuButton, chooseLayout, closeRewrite, DRAFT_PROJECT as PROJECT, draftAndOpen, findingsField, openCardMenu, previewArticle, revealCardMenu, rewritesLeft, signInToDraft, startRewrite, waitForSaved } from "./editor";
import { freshName, READY } from "./page-editor";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Draft tools (docs/phase-2.md section 6): the kept source text and AI version, "Rewrite this
// block", "Back to the AI version" and the drafting screen. No API key in tests, so the AI is the
// labelled placeholder (lib/ai/exhbt-draft.ts, lib/ai/exhbt-rewrite.ts).

const FREE_REWRITES = ENTITLEMENTS.free.blockRegenerations;

test.describe("Block helpers", () => {
  /** The findings block is the findings section (decision 0015). */
  const withFindings = (d: ExhbtDoc, items: RichText[]): ExhbtDoc => ({ ...d, sections: [{ id: "findings", kind: "findings", items }] });
  const doc = withFindings({ ...emptyDoc(), title: "Reminders", gap: text("Did timing matter?"), skills: ["Python"] }, [text("Fell from 7.9% to 6.5%."), text("Cleaned 14,200 rows.")]);

  test("a block can be read, replaced and compared", () => {
    expect(blockValue(doc, "skills")).toEqual(["Python"]);
    expect(sameBlock(blockValue(doc, "findings"), [text("Fell from 7.9% to 6.5%."), text("Cleaned 14,200 rows.")])).toBe(true);
    expect(sameBlock(blockValue(doc, "gap"), text("Different."))).toBe(false);
  });

  test("replacing a block drops flags for numbers that are gone and adds the new block's", () => {
    const flagged = { ...withFindings(doc, [text("Fell 18%."), text("Cleaned 14,200 rows.")]), unverified: ["18%"] };
    const next = replaceBlock(flagged, "findings", [text("Fell from 7.9% to 6.5%."), text("Up 22%.")], ["22%"]);
    expect(next.unverified).toEqual(["22%"]);
    expect(next.title).toBe("Reminders");
  });

  test("the AI version keeps each block, with the numbers the source lacks", () => {
    const ai = aiVersionOf(withFindings(doc, [text("Fell 18%."), text("Cleaned 14,200 rows.")]), PROJECT);
    expect(ai.unverified.findings).toEqual(["18%"]);
    expect(ai.unverified.gap).toEqual([]);
    expect(ai.blocks.skills).toEqual(["Python"]);
  });
});

test.describe("Draft from a file", () => {
  test("a text file is drafted and the editor opens with the rewrite tools", async ({ page }) => {
    await signInToDraft(page, "txt");
    await page.locator("#files").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(PROJECT) });
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toBeAttached();
    // Each block's More actions, on a section from its toolbar's own More actions where that is the compact pair (decision 0026).
    for (const block of ["header", "skills", "gap", "flow", "findings"]) {
      await revealCardMenu(page, block);
      await expect(cardMenuButton(page, block)).toBeVisible();
    }
    await openCardMenu(page, "findings");
    await expect(rewritesLeft(page, "findings")).toBeVisible();
    await expect(rewritesLeft(page, "findings")).toHaveText(`${FREE_REWRITES} of ${FREE_REWRITES} rewrites left`);
  });

  test("an exhbt started from scratch has no rewrite tools", async ({ page }) => {
    await signInToDraft(page, "scratch");
    await page.goto("/exhbts");
    await startBlank(page);
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    await expect(page.getByRole("heading", { level: 1, name: "Edit exhbt" })).toBeAttached();
    await expect(page.getByTestId("tools-findings")).toHaveCount(0);
  });
});

test.describe("Rewrite and back to the AI version", () => {
  test("rewriting the findings with a note changes the text and uses up a rewrite", async ({ page }) => {
    await draftAndOpen(page, "rewrite");
    const before = await findingsField(page).innerText();
    expect(before).not.toContain("Preview rewrite");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(cardMenuButton(page, "findings")).toBeFocused();
    await expect(cardMenuButton(page, "findings")).toHaveAttribute("aria-expanded", "false");

    await startRewrite(page, "findings");
    await page.getByLabel("Note for the rewrite").fill("shorter");
    await page.getByRole("button", { name: "Rewrite the findings now" }).click();

    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await expect(rewritesLeft(page, "findings")).toHaveText(`${FREE_REWRITES - 1} of ${FREE_REWRITES} rewrites left`);
    // Every card shows the same count.
    await expect(rewritesLeft(page, "gap")).toHaveText(`${FREE_REWRITES - 1} of ${FREE_REWRITES} rewrites left`);
    await expect(page.getByTestId("tools-findings").getByTestId("tools-status")).toContainText("Rewritten.");

    // It survives a reload (autosave) and the count is the server's.
    // "Saved" is on screen but not announced (SaveStatus.tsx says only failures), so it is not in a status region: wait for the words and the stored doc.
    await waitForSaved(page);
    await page.reload();
    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await expect(rewritesLeft(page, "findings")).toContainText(`${FREE_REWRITES - 1} of`);
  });

  test("Back to the AI version restores the AI's wording after an edit", async ({ page }) => {
    await draftAndOpen(page, "undo");
    const original = await findingsField(page).innerText();
    await expect(backToAiVersion(page, "findings")).toHaveCount(0);

    await findingsField(page).click();
    // The click starts the field's editor; keys typed before it has the cursor go nowhere (fillRich waits the same way).
    await expect(findingsField(page).locator(".ProseMirror")).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.type(" MY OWN EDIT");
    await expect(findingsField(page)).toContainText("MY OWN EDIT");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toBeVisible();
    await backToAiVersion(page, "findings").click();
    await expect(findingsField(page)).not.toContainText("MY OWN EDIT");
    expect((await findingsField(page).innerText()).trim()).toBe(original.trim());
    await expect(backToAiVersion(page, "findings")).toHaveCount(0);

    // After a rewrite, "the AI version" is the rewrite.
    await startRewrite(page, "findings");
    await page.getByRole("button", { name: "Rewrite the findings now" }).click();
    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await findingsField(page).click();
    // The click starts the field's editor; keys typed before it has the cursor go nowhere (fillRich waits the same way).
    await expect(findingsField(page).locator(".ProseMirror")).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.type(" SECOND EDIT");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toBeVisible();
    await backToAiVersion(page, "findings").click();
    await expect(findingsField(page)).toContainText("Preview rewrite 1");
    await expect(findingsField(page)).not.toContainText("SECOND EDIT");
  });

  test("on Free the rewrites run out, and the server refuses another with the reason", async ({ page }) => {
    await draftAndOpen(page, "limit");
    // A second tab that doesn't know the count has changed.
    const stale = await page.context().newPage();
    await stale.goto(page.url());
    await expect(rewritesLeft(stale, "flow")).toContainText(`${FREE_REWRITES} of`);

    for (let i = 1; i <= FREE_REWRITES; i++) {
      await startRewrite(page, "flow");
      await page.getByRole("button", { name: "Rewrite the process now" }).click();
      await expect(rewritesLeft(page, "flow")).toContainText(`${FREE_REWRITES - i} of`);
    }
    await startRewrite(page, "flow");
    await expect(page.getByTestId("tools-flow")).toContainText("No rewrites left on this exhbt.");
    await expect(page.getByTestId("tools-flow").getByRole("link", { name: "See your plan" })).toHaveAttribute("href", "/account/billing");
    // It holds nothing and has no Cancel: Escape closes it, and gives the focus back to More actions; so does a press anywhere else.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tools-flow")).not.toContainText("No rewrites left on this exhbt.");
    await expect(cardMenuButton(page, "flow")).toBeFocused();
    await startRewrite(page, "flow");
    await expect(page.getByTestId("tools-flow")).toContainText("No rewrites left on this exhbt.");
    await page.mouse.click(4, 600);
    await expect(page.getByTestId("tools-flow")).not.toContainText("No rewrites left on this exhbt.");

    await startRewrite(stale, "flow");
    await stale.getByRole("button", { name: "Rewrite the process now" }).click();
    const status = stale.getByTestId("tools-flow").getByTestId("tools-status");
    await expect(status).toContainText(`You've used all ${FREE_REWRITES} rewrites for this exhbt on the Free plan.`);
    await expect(status.getByRole("link", { name: "See your plan" })).toHaveAttribute("href", "/account/billing");
    await expect(stale.locator("body")).not.toContainText(`Preview rewrite ${FREE_REWRITES + 1}`);
  });

  test("no accessibility violations on the editor with the rewrite controls open", async ({ page }) => {
    await draftAndOpen(page, "a11y");
    // Make "Back to the AI version" show on the findings card too, so it is scanned, with its menu open. Typed before the
    // forms open: an open form is a card over the first words of its section (css/draft-tools.css), and stays there.
    await findingsField(page).click();
    // The click starts the field's editor; keys typed before it has the cursor go nowhere (fillRich waits the same way).
    await expect(findingsField(page).locator(".ProseMirror")).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.type(" extra");
    await startRewrite(page, "findings");
    await startRewrite(page, "gap");
    await openCardMenu(page, "findings");
    await expect(backToAiVersion(page, "findings")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

// A section's toolbar, and a shell part's corner toolbar, show under the pointer or the focus (decision 0026). "Rewrite
// this block" hides the button that was pressed, so the focus falls to the page and only the pointer is left holding the
// toolbar up. A press on a button below the fold scrolls the page under the still pointer, which takes that away too: the
// toolbar went, the form with it, and the section under it took the press ("on Free the rewrites run out" above, whenever
// the runner was slow enough). So these tests take the pointer and the focus off the page's parts on purpose: an open
// form must still be drawn, lie over whatever is under it, and take the press, whatever the layout and wherever the
// part's toolbar sits. Nothing here depends on the window's height or on what is above the page.
test.describe("An open rewrite form stays up and takes the press", () => {
  const BLOCKS = ["header", "skills", "gap", "flow", "findings"] as const;
  /** The form's own button ("Rewrite the process now"), whatever the layout calls the part. */
  const rewriteNow = (page: Page, block: string) => page.getByTestId(`tools-${block}`).getByRole("button", { name: /^Rewrite the .+ now$/ });

  /** Takes the pointer off the page's parts and the focus out of them: nothing there is under the pointer, and nothing has the focus. */
  async function leave(page: Page) {
    await page.mouse.move(2, 2);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect.poll(() => page.evaluate(() => document.activeElement === document.body && !document.querySelector('[data-editor="page"] article :hover'))).toBe(true);
  }

  /** The block's open form is drawn, a press on its button would land on the button, and nothing on the page lies over any of it. */
  async function takesThePress(page: Page, block: string, what: string) {
    const button = rewriteNow(page, block);
    await expect(button, what).toBeVisible();
    // An unforced press, short of pressing: Playwright scrolls the button into view and checks that the press would land on it.
    await button.click({ trial: true, timeout: 20_000 });
    const found = await page.getByTestId(`tools-${block}`).evaluate((tools) => {
      const name = (e: Element) => `${e.tagName.toLowerCase()}.${e.getAttribute("class") ?? ""}`.slice(0, 80);
      // Drawn, not only laid out (Playwright counts a see-through button as visible).
      for (let e: Element | null = tools; e; e = e.parentElement) if (getComputedStyle(e).opacity !== "1") return `see-through at ${name(e)}`;
      // Every point of it that is on screen, under the editor's top bar, is its own: nothing later on the page is drawn over it.
      // Its button, and the form: in a card of its own under the button, out of the button's box, outside the compact card
      // (css/draft-tools.css).
      const panel = tools.querySelector("[data-tools-panel]");
      const parts = [tools, ...(panel && getComputedStyle(panel).position === "absolute" ? [panel] : [])];
      let seen = 0;
      for (const part of parts) {
        const r = part.getBoundingClientRect();
        // A press outside a rounded corner is not the card's.
        const round = parseFloat(getComputedStyle(part).borderTopLeftRadius) || 0;
        const corner = (x: number, y: number) => (x < r.left + round || x > r.right - round) && (y < r.top + round || y > r.bottom - round);
        const top = Math.max(r.top, document.querySelector("[data-topbar]")?.getBoundingClientRect().bottom ?? 0);
        for (let y = top + 2; y < Math.min(r.bottom, window.innerHeight) - 1; y += 6) {
          for (let x = Math.max(r.left, 0) + 2; x < Math.min(r.right, window.innerWidth) - 1; x += 6) {
            if (corner(x, y)) continue;
            const at = document.elementFromPoint(x, y);
            if (!at || !tools.contains(at)) return `${at ? name(at) : "nothing"} is over it at ${Math.round(x - r.left)}, ${Math.round(y - r.top)} of ${Math.round(r.width)} by ${Math.round(r.height)}`;
            seen++;
          }
        }
      }
      return seen > 50 ? "drawn, on top" : `only ${seen} points of it are on screen`;
    });
    expect(found, what).toBe("drawn, on top");
  }

  for (const layout of ["Case study", "Gallery", "Research"] as const) {
    test(`${layout}: each drafted part's form, with the pointer and the focus off the page's parts`, async ({ page }) => {
      await draftAndOpen(page, "stays");
      if (layout !== "Case study") {
        await chooseLayout(page, layout);
        await page.keyboard.press("Escape");
      }
      await expect(page.getByRole("button", { name: `Layout: ${layout}` })).toBeVisible();
      await expect(previewArticle(page)).toBeVisible();
      for (const block of BLOCKS) {
        await startRewrite(page, block);
        await leave(page);
        await takesThePress(page, block, `${layout}, ${block}`);
        await closeRewrite(page, block);
      }
      // And the press itself on the flowchart's form, as "on Free the rewrites run out" makes it.
      await startRewrite(page, "flow");
      await leave(page);
      await rewriteNow(page, "flow").click();
      await expect(rewritesLeft(page, "flow")).toContainText(`${FREE_REWRITES - 1} of`);
    });
  }

  /**
   * Holds a section's toolbar in one place. The editor places each toolbar by measuring the page (placeTools in
   * components/exhbt-editor/Toolbar.tsx) and writes the place on it as data-place, with none for a row above the corner;
   * held, the attribute is put back whenever the editor writes another.
   */
  const hold = (el: Element, want: string | null) => {
    const held = el as Element & { held?: MutationObserver };
    held.held?.disconnect();
    const put = () => {
      if (want === null) el.removeAttribute("data-place");
      else if (el.getAttribute("data-place") !== want) el.setAttribute("data-place", want);
    };
    put();
    held.held = new MutationObserver(put);
    held.held.observe(el, { attributes: true, attributeFilter: ["data-place"] });
  };

  test("the flowchart's form and the findings' form, in each place a section's toolbar can be", async ({ page }) => {
    test.setTimeout(150_000); // ten forms opened and closed
    await draftAndOpen(page, "places");
    for (const block of ["flow", "findings"] as const) {
      const tools = page.locator(`${READY} [data-kind="${block}"] > .xe-tools`).first();
      for (const place of ["above", "edge", "side", "rcol", "compact"] as const) {
        const want = place === "above" ? null : place;
        await tools.evaluate(hold, want);
        await startRewrite(page, block);
        await leave(page);
        expect(await tools.getAttribute("data-place"), `${block}, held ${place}`).toBe(want);
        await takesThePress(page, block, `${block}, toolbar ${place}`);
        await closeRewrite(page, block);
      }
    }
  });

  test("a section raised for its open menu still passes under the editor's top bar as the page scrolls", async ({ page }) => {
    // A short window, so the page can scroll far enough to bring the flowchart's menu level with the bar.
    await page.setViewportSize({ width: 1440, height: 480 });
    await draftAndOpen(page, "underbar");
    await startRewrite(page, "flow");
    await leave(page);
    const at = await page.getByTestId("tools-flow").evaluate((tools) => {
      const bar = document.querySelector("[data-topbar]")!.getBoundingClientRect();
      const more = tools.querySelector("button")!;
      window.scrollBy(0, more.getBoundingClientRect().top - bar.top - 10);
      const r = more.getBoundingClientRect();
      const found = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { levelWithTheBar: r.top < bar.bottom && r.bottom > bar.top, theBarIsOverIt: Boolean(found?.closest("[data-topbar]")) };
    });
    expect(at).toEqual({ levelWithTheBar: true, theBarIsOverIt: true });
  });

  /*
   * Outside the compact card, an open form was drawn straight over the page's words, with no ground of its own; and in
   * the app's ink it could not be read on a dark look's well, in the compact card too. Now the menu and the panel (the
   * form, "No rewrites left" and the line that says how a rewrite went) are on the compact card's ground, the look's
   * well, in the look's own words (css/draft-tools.css).
   */
  test.describe("An open menu or rewrite form has a ground of its own, in every place and every look", () => {
    const PLACES = ["above", "edge", "side", "rcol", "compact"] as const;

    /** Signs in as a new person on Max (which has every look) in look `id`, drafts through the API and opens the editor. */
    async function draftInLook(page: Page, id: string) {
      const user = freshName(`ground${id}`);
      await page.goto(`/dev/portfolio?username=${user}&plan=max&count=0&look=${id}`);
      await page.goto(`/auth/dev?email=${user}@example.com&next=${encodeURIComponent(DRAFT_WITH_AI)}`);
      await expect(page.getByRole("heading", { level: 1, name: "Draft it from your files" })).toBeVisible();
      const res = await page.request.post("/api/exhbts/draft", { data: { text: PROJECT } });
      expect(res.status()).toBe(200);
      const { id: exhbt } = (await res.json()) as { id: string };
      await page.goto(`/exhbts/${exhbt}/edit`);
      await expect(page.locator(READY)).toBeAttached();
      await expect(page.locator(`${READY} [data-theme="${id}"]`).first()).toBeAttached();
    }

    /**
     * What is wrong with the ground under the open menu or panel of a block's "More actions", or nothing. Its ground (the first
     * opaque ground under it) is the compact card's, the look's well; and every word in it, and the note field's placeholder,
     * lies inside an opaque ground that belongs to its toolbar (its own card, the compact card, or a button or field of its
     * own), drawn at full strength, at 4.5:1 or more against that ground.
     */
    const groundProblems = (page: Page, block: string, part: "menu" | "panel") =>
      page.getByTestId(`tools-${block}`).evaluate((root, part) => {
        const scope = root.querySelector(part === "menu" ? "[data-tools-menu]" : "[data-tools-panel]")!;
        const bar = root.closest(".xe-tools, .xe-shell-tools")!;
        const name = (e: Element) => `${e.tagName.toLowerCase()}.${(e.getAttribute("class") ?? "").split(/\s+/).slice(0, 3).join(".")}`;
        const parse = (c: string) => {
          const n = (c.match(/-?[\d.]+(e-?\d+)?/g) ?? []).map(Number);
          if (c.startsWith("color(")) return { r: n[0]! * 255, g: n[1]! * 255, b: n[2]! * 255, a: n[3] ?? 1 };
          return { r: n[0]!, g: n[1]!, b: n[2]!, a: c.startsWith("rgba") ? n[3]! : 1 };
        };
        const lum = (c: { r: number; g: number; b: number }) =>
          [c.r, c.g, c.b].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
        const ratio = (fg: string, bg: { r: number; g: number; b: number }) => {
          const f = parse(fg);
          // A see-through colour is drawn over its ground.
          const on = { r: f.r * f.a + bg.r * (1 - f.a), g: f.g * f.a + bg.g * (1 - f.a), b: f.b * f.a + bg.b * (1 - f.a) };
          const [x, y] = [lum(on), lum(bg)].sort((p, q) => q - p);
          return (x! + 0.05) / (y! + 0.05);
        };
        const groundOf = (el: Element) => {
          for (let e: Element | null = el; e; e = e.parentElement) {
            const c = parse(getComputedStyle(e).backgroundColor);
            if (c.a > 0) return { e, c };
          }
          return null;
        };
        const well = (() => {
          const probe = document.createElement("span");
          probe.style.backgroundColor = "var(--xp-card)";
          root.appendChild(probe);
          const c = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return c;
        })();
        const problems: string[] = [];
        const own = groundOf(scope);
        if (!own || getComputedStyle(own.e).backgroundColor !== well) problems.push(`its ground is ${own ? `${getComputedStyle(own.e).backgroundColor} (${name(own.e)})` : "nothing"}, not the compact card's ${well}`);
        const check = (el: Element, what: string, colour: string) => {
          const g = groundOf(el);
          if (!g || !bar.contains(g.e)) return problems.push(`${what} is drawn straight over ${g ? name(g.e) : "nothing"}, not on a ground of its own`);
          if (g.c.a < 1) return problems.push(`${what} is on a see-through ground (${name(g.e)})`);
          const [r, o] = [el.getBoundingClientRect(), g.e.getBoundingClientRect()];
          if (r.left < o.left - 1 || r.right > o.right + 1 || r.top < o.top - 1 || r.bottom > o.bottom + 1) return problems.push(`${what} runs out of its ground (${name(g.e)})`);
          for (let e: Element | null = el; e; e = e.parentElement) if (getComputedStyle(e).opacity !== "1") return problems.push(`${what} is faded at ${name(e)}`);
          const c = ratio(colour, g.c);
          if (c < 4.5) problems.push(`${what} is ${c.toFixed(2)}:1 on ${name(g.e)}`);
        };
        for (const el of scope.querySelectorAll("*")) {
          const words = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join("").trim();
          if (words && el.getClientRects().length > 0) check(el, `"${words.slice(0, 40)}"`, getComputedStyle(el).color);
        }
        for (const field of scope.querySelectorAll("input")) check(field, "the note field's placeholder", getComputedStyle(field, "::placeholder").color);
        return problems;
      }, part);

    /** Opens the block's menu, then its form, each checked for its ground; then closes the form. `what` names the case. */
    /**
     * Presses "Rewrite this block" in the block's open menu from the keyboard, with the pointer off the page first. Chromium's
     * headless shell, which CI runs, can leave the box that holds the form (data-tools-panel) marked as hovered when what the
     * pointer was on goes from under it: a rewrite lands, the form goes, and a compact card round it closes. The mark outlasts
     * the pointer leaving, on that box alone, which nothing styles on hover, so the page is unchanged; but leave() would wait
     * for it in vain (the Night test, 4 times in 4 there). So these tests make every press in a panel from the keyboard.
     */
    async function rewriteFromKeys(p: Page, block: string) {
      await p.mouse.move(2, 2);
      await p.getByTestId(`tools-${block}`).getByRole("button", { name: "Rewrite this block" }).press("Enter");
    }

    async function eachOnItsOwnGround(page: Page, block: string, what: string) {
      await openCardMenu(page, block);
      expect(await groundProblems(page, block, "menu"), `${what}: the menu`).toEqual([]);
      await rewriteFromKeys(page, block);
      await leave(page);
      await expect(rewriteNow(page, block)).toBeVisible();
      expect(await groundProblems(page, block, "panel"), `${what}: the form`).toEqual([]);
      await takesThePress(page, block, what);
      await closeRewrite(page, block);
    }

    // One test per look, so a busy machine can't run one out of time.
    for (const look of PORTFOLIO_THEMES) {
      test(`in the ${look.name || look.id} look: the flowchart's in each place a section's toolbar can be, and the title's, the context line's and the skills'`, async ({ page }) => {
        test.setTimeout(150_000);
        await draftInLook(page, look.id);
        const tools = page.locator(`${READY} [data-kind="flow"] > .xe-tools`).first();
        for (const place of PLACES) {
          await tools.evaluate(hold, place === "above" ? null : place);
          await eachOnItsOwnGround(page, "flow", `${look.id}, the flowchart's toolbar ${place}`);
        }
        for (const block of ["header", "gap", "skills"] as const) await eachOnItsOwnGround(page, block, `${look.id}, ${block}`);
      });
    }

    test(`in the Night look: "No rewrites left", and the reason a rewrite was refused`, async ({ page }) => {
      test.setTimeout(150_000);
      await draftInLook(page, "night");
      // A second tab that doesn't know the count has changed.
      const stale = await page.context().newPage();
      await stale.goto(page.url());
      await expect(stale.locator(READY)).toBeAttached();
      // Each page is in front while it is driven: a page in the background is not drawn again, so what is under its pointer would not change.
      await page.bringToFront();
      // Free's rewrites run out sooner than Max's, and both pages keep the look they were drawn in (Max's).
      expect((await page.request.get("/dev/plan?plan=free&next=/exhbts")).ok()).toBe(true);
      for (let i = 1; i <= FREE_REWRITES; i++) {
        await openCardMenu(page, "flow");
        await rewriteFromKeys(page, "flow");
        await rewriteNow(page, "flow").press("Enter");
        await expect(rewritesLeft(page, "flow")).toContainText(`${FREE_REWRITES - i} of`);
      }
      for (const p of [page, stale]) await p.locator(`${READY} [data-kind="flow"] > .xe-tools`).first().evaluate(hold, null);
      await openCardMenu(page, "flow");
      await rewriteFromKeys(page, "flow");
      await expect(page.getByTestId("tools-flow")).toContainText("No rewrites left on this exhbt.");
      await leave(page);
      expect(await groundProblems(page, "flow", "panel"), "No rewrites left").toEqual([]);

      await stale.bringToFront();
      await openCardMenu(stale, "flow");
      await rewriteFromKeys(stale, "flow");
      await rewriteNow(stale, "flow").press("Enter");
      await expect(stale.getByTestId("tools-flow").getByTestId("tools-status")).toContainText(`You've used all ${FREE_REWRITES} rewrites`);
      await leave(stale);
      expect(await groundProblems(stale, "flow", "panel"), "a refused rewrite").toEqual([]);
    });
  });

  /*
   * An open form stays until it is cancelled or used (above), so a note typed in it is not lost: a press anywhere else, or the
   * focus going into a field on the page, leaves it, in a toolbar's compact card too, which used to close and hide it (decision
   * 0026: while it is open its toolbar stays, wherever the pointer and the focus are). Escape closes it, and its menu, and gives
   * the focus back to "More actions": with the focus in it, and with the focus on nothing, as it is once "Rewrite this block" is
   * pressed. In the compact card the form's Escape comes first, then the card's.
   */
  test.describe("Escape closes an open menu or rewrite form and gives the focus back to More actions; a press outside leaves the form", () => {
    const noteField = (page: Page, block: string) => page.getByTestId(`tools-${block}`).getByRole("textbox", { name: /^Note for the rewrite/ });

    for (const where of ["the flowchart's toolbar in its own place, the compact card", "the flowchart's toolbar above its corner", "the context line's corner toolbar"] as const) {
      test(where, async ({ page }) => {
        await draftAndOpen(page, "escape");
        const block = where.startsWith("the flowchart") ? "flow" : "gap";
        const tools = page.locator(`${READY} [data-kind="flow"] > .xe-tools`).first();
        if (where.includes("above")) await tools.evaluate(hold, null);
        else if (block === "flow") expect(await tools.getAttribute("data-place")).toBe("compact");
        const more = cardMenuButton(page, block);

        // The menu.
        await openCardMenu(page, block);
        await expect(more).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");
        await expect(more, where).toHaveAttribute("aria-expanded", "false");
        await expect(more, where).toBeFocused();

        // The form, a note typed in it: a press on the page's margin, then in the title, leaves it, with the note.
        await startRewrite(page, block);
        await noteField(page, block).fill("shorter");
        for (const press of ["the margin", "the title"]) {
          if (press === "the margin") await page.mouse.click(4, 600);
          else await page.locator(`${READY} #title`).click();
          await takesThePress(page, block, `${where}, after a press on ${press}`);
          await expect(noteField(page, block), `${where}, after a press on ${press}`).toHaveValue("shorter");
        }
        // Escape with the focus on nothing.
        await page.mouse.click(4, 600);
        await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
        await page.keyboard.press("Escape");
        await expect(rewriteNow(page, block), where).toHaveCount(0);
        await expect(more, where).toBeFocused();

        // Escape with the focus in the form.
        await startRewrite(page, block);
        await noteField(page, block).focus();
        await page.keyboard.press("Escape");
        await expect(rewriteNow(page, block), where).toHaveCount(0);
        await expect(more, where).toBeFocused();

        if (block === "flow" && !where.includes("above")) {
          // The compact card is still open round "More actions"; the next Escape closes it, and the focus goes to its own button.
          await expect(tools).toHaveAttribute("data-open", "");
          await page.keyboard.press("Escape");
          await expect(tools).not.toHaveAttribute("data-open", "");
          await expect(tools.locator('[data-tool="menu"]')).toBeFocused();
        }
      });
    }

    test("while a rewrite runs, Escape leaves its form, as Cancel is off; the rewrite closes it", async ({ page }) => {
      await draftAndOpen(page, "escapebusy");
      // The rewrite (the server action given the block's name) is held on its way.
      let release = () => {};
      const out = new Promise<void>((r) => (release = r));
      let holding = false;
      await page.route(/\/exhbts\/[0-9a-f-]{36}\/edit/, async (route) => {
        const req = route.request();
        let args: unknown[] = [];
        try {
          args = JSON.parse(req.postData() ?? "[]") as unknown[];
        } catch {}
        if (req.method() !== "POST" || !req.headers()["next-action"] || args[1] !== "flow") return route.continue();
        holding = true;
        await out;
        return route.continue();
      });
      await startRewrite(page, "flow");
      await rewriteNow(page, "flow").click();
      await expect.poll(() => holding).toBe(true);
      await expect(page.getByTestId("tools-flow").getByRole("button", { name: "Cancel" })).toBeDisabled();
      for (const where of ["on nothing", "in the form"]) {
        if (where === "on nothing") await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        else await noteField(page, "flow").focus();
        await page.keyboard.press("Escape");
        await expect(noteField(page, "flow"), `the focus ${where}`).toBeVisible();
      }
      release();
      await expect(rewritesLeft(page, "flow")).toContainText(`${FREE_REWRITES - 1} of`);
      await expect(noteField(page, "flow")).toHaveCount(0);
    });
  });
});

test.describe("The drafting screen", () => {
  test("shows three steps and the usual time, then completes and opens the editor", async ({ page }) => {
    await signInToDraft(page, "progress");
    await page.route("**/api/exhbts/draft", async (route) => {
      await new Promise((r) => setTimeout(r, 8000));
      await route.continue();
    });
    await page.locator("#files").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(PROJECT) });
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await page.getByRole("button", { name: "Draft my exhbt" }).click();

    const view = page.getByTestId("drafting");
    await expect(view).toContainText("usually takes about 20 seconds");
    const steps = view.getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("Reading your files");
    await expect(steps.nth(1)).toContainText("Finding the numbers");
    await expect(steps.nth(2)).toContainText("Writing your exhbt");
    await expect(steps.nth(0)).toHaveAttribute("data-state", "active");
    await expect(steps.nth(2)).toHaveAttribute("data-state", "waiting");
    // The timer moves on while we wait.
    await expect(steps.nth(1)).toHaveAttribute("data-state", "active");
    await expect(steps.nth(0)).toHaveAttribute("data-state", "done");
    // The answer arrives: everything is ticked, then the editor opens.
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
  });

  test("if drafting fails the files and notes stay and Try again works without uploading again", async ({ page }) => {
    await signInToDraft(page, "fail");
    let uploads = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/files/upload-url")) uploads++;
    });
    await page.locator("#files").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(PROJECT) });
    await expect(page.getByTestId("file-status")).toContainText("uploaded");
    await page.locator("#notes").fill("Two practices over six weeks.");

    await page.route("**/api/exhbts/draft", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "We couldn't draft your exhbt just now. Your files are saved: try again in a moment." }) }),
    );
    await page.getByRole("button", { name: "Draft my exhbt" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "couldn't draft" });
    await expect(alert).toBeVisible();
    await expect(page.getByTestId("drafting")).toHaveCount(0);
    await expect(page.locator("#file-list")).toContainText("notes.txt");
    await expect(page.locator("#notes")).toHaveValue("Two practices over six weeks.");

    await page.unroute("**/api/exhbts/draft");
    await alert.getByRole("button", { name: "Try again" }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/);
    expect(uploads).toBe(1);
  });
});
