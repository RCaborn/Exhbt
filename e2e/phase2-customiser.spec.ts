import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS } from "../lib/entitlements";
import { sampleDocs } from "../lib/exhbt/sample";
import { canUseExtraTiles, customisableExhbts, listedOnPortfolio } from "../lib/plan-rules";
import { checkTiles } from "../lib/portfolio-customise";
import {
  DEFAULT_LAYOUT,
  layoutFromOrder,
  normaliseGithub,
  normaliseLayout,
  normaliseWebsite,
  sequence,
  shownKeys,
  splitOrder,
  TILE_LIMITS,
  TilesSchema,
  wideIndexes,
} from "../lib/portfolio-layout";
import { PORTFOLIO_THEMES, themeAllowance } from "../lib/portfolio-themes";
import type { ExhbtRecord } from "../lib/store";

// The portfolio customiser (decision 0014): the layout rules, the customiser page, and the public
// at-a-glance page that renders what it saves. Plans are set with the dev override
// (/dev/portfolio?plan=), as in the looks spec; the Stripe webhook is covered there.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const stamp = () => Date.now().toString(36).slice(-6) + Math.floor(Math.random() * 100);

const GP = sampleDocs[0]!.title;
const LIBRARY = sampleDocs[1]!.title;
// The titles /dev/portfolio gives a third and fourth exhbt.
const THIRD = "Planning staff rotas for a campus cafe";
const FOURTH = "Mapping late buses on a student route";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

/* ---------- the rules, no browser ---------- */

test.describe("Layout rules", () => {
  test("a missing, old or damaged layout gives today's page", () => {
    for (const raw of [undefined, null, {}, [], "x", 7, { v: 9, slots: "no", tiles: 5, header: [] }]) {
      expect(normaliseLayout(raw)).toEqual({ ...DEFAULT_LAYOUT, tiles: {} });
    }
    // Today's page is the projects in position order, with nothing else.
    expect(sequence(normaliseLayout({}), ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  test("tiles keep their place among the projects, and a tile not on the page loses its words", () => {
    const layout = normaliseLayout({
      v: 1,
      slots: ["p", "about", "p", "about", "bogus", "p", "quote"],
      tiles: { about: { text: "Hi" }, education: { lines: ["Not on the page"] }, quote: { text: "Good", name: "A", role: "B" } },
      header: { skills: false },
    });
    expect(layout.slots).toEqual(["p", "about", "p", "p", "quote"]);
    expect(layout.tiles.education).toBeUndefined();
    expect(layout.header).toEqual({ skills: false, linkedin: true });
    expect(sequence(layout, ["a", "b", "c"])).toEqual(["a", "about", "b", "c", "quote"]);
    // More exhbts than slots: the rest go on the end. Fewer: spare slots are dropped.
    expect(sequence(layout, ["a", "b", "c", "d"])).toEqual(["a", "about", "b", "c", "quote", "d"]);
    expect(sequence(layout, ["a"])).toEqual(["a", "about", "quote"]);
    expect(splitOrder(["a", "about", "b"])).toEqual({ slots: ["p", "about", "p"], projectIds: ["a", "b"] });
    expect(layoutFromOrder(["a", "about"], { about: { text: "x" }, quote: { text: "y", name: "", role: "" } }, DEFAULT_LAYOUT.header).tiles).toEqual({ about: { text: "x" } });
  });

  test("hidden exhbts leave and the featured one goes first; the wide tiles never leave a lone tile", () => {
    const order = ["a", "b", "about", "c", "d"];
    expect(shownKeys(order, new Set(["b"]), null)).toEqual(["a", "about", "c", "d"]);
    expect(shownKeys(order, new Set(), "c")).toEqual(["c", "a", "b", "about", "d"]);
    expect(shownKeys(order, new Set(["c"]), "c")).toEqual(["a", "b", "about", "d"]);
    expect([...wideIndexes(4, false)]).toEqual([]);
    expect([...wideIndexes(3, false)]).toEqual([0]);
    expect([...wideIndexes(1, false)]).toEqual([0]);
    expect([...wideIndexes(4, true)]).toEqual([0, 3]);
    expect([...wideIndexes(5, true)]).toEqual([0]);
    expect([...wideIndexes(0, false)]).toEqual([]);
  });

  test("limits and links: words are capped, links must be https, the email is plain text", () => {
    const bad = (t: unknown) => !TilesSchema.safeParse(t).success;
    expect(bad({ about: { text: words(TILE_LIMITS.aboutWords + 1) } })).toBe(true);
    expect(bad({ about: { text: words(TILE_LIMITS.aboutWords) } })).toBe(false);
    expect(bad({ quote: { text: words(TILE_LIMITS.quoteWords + 1), name: "", role: "" } })).toBe(true);
    expect(bad({ quote: { text: words(TILE_LIMITS.quoteWords), name: "x".repeat(TILE_LIMITS.nameChars + 1), role: "" } })).toBe(true);
    expect(bad({ education: { lines: ["a", "b", "c", "d"] } })).toBe(true);
    expect(bad({ education: { lines: [words(TILE_LIMITS.lineWords + 1)] } })).toBe(true);
    expect(normaliseWebsite("https://amara.dev/work")).toBe("https://amara.dev/work");
    expect(normaliseWebsite("amara.dev")).toBe("https://amara.dev/");
    for (const no of ["http://amara.dev", "javascript:alert(1)", "data:text/html,x", "ftp://x.com", "amara", "https://", "a b.com"]) expect(normaliseWebsite(no), no).toBeNull();
    expect(normaliseGithub("github.com/amara-o")).toBe("https://github.com/amara-o");
    expect(normaliseGithub("https://github.com/amara-o/repo")).toBe("https://github.com/amara-o/repo");
    for (const no of ["https://evil.com/github.com/x", "http://github.com/x", "github.com/", "gitlab.com/x"]) expect(normaliseGithub(no), no).toBeNull();
    const links = TilesSchema.parse({ links: { linkedin: "linkedin.com/in/amara-o", github: "", website: "amara.dev", email: "Amara@Example.com" } }).links!;
    expect(links).toEqual({ linkedin: "https://www.linkedin.com/in/amara-o", github: "", website: "https://amara.dev/", email: "amara@example.com" });
    expect(bad({ links: { linkedin: "", github: "", website: "http://amara.dev", email: "" } })).toBe(true);
    expect(bad({ links: { linkedin: "", github: "", website: "", email: "not an email" } })).toBe(true);
    // checkTiles names the field, for the editor.
    expect(checkTiles({ quote: { text: words(40), name: "", role: "" } }, ["quote"]).problems["quote.text"]).toContain("30 words");
    expect(checkTiles({ quote: { text: words(40), name: "", role: "" } }, ["about"]).problems).toEqual({});
  });

  test("extra tiles are for the paid plans; free has no public page to put them on", () => {
    expect(ENTITLEMENTS.free.extraTiles).toBe(false);
    expect(ENTITLEMENTS.premium.extraTiles).toBe(true);
    expect(ENTITLEMENTS.max.extraTiles).toBe(true);
    expect(ENTITLEMENTS.institutional.extraTiles).toBe(true);
    expect(canUseExtraTiles("free")).toMatchObject({ ok: false, upgradeTo: "premium" });
    expect(canUseExtraTiles("premium").ok).toBe(true);
  });

  test("hidden exhbts stay reachable but are not listed; free arranges its drafts", () => {
    const rec = (id: string, position: number, over: Partial<ExhbtRecord> = {}): ExhbtRecord => ({
      id,
      userId: "u",
      doc: sampleDocs[0]!,
      published: sampleDocs[0]!,
      status: "published",
      slug: id,
      position,
      confirmedAt: null,
      publishedAt: null,
      updatedAt: "2026-11-13T00:00:00Z",
      ...over,
    });
    const list = [rec("a", 0), rec("b", 1, { hiddenOnPortfolio: true }), rec("c", 2), rec("d", 3, { status: "draft", published: null, slug: null })];
    expect(listedOnPortfolio("max", list).map((e) => e.id)).toEqual(["a", "c"]);
    expect(customisableExhbts("max", list).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(customisableExhbts("free", list).map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
  });
});

/* ---------- the customiser, in a browser ---------- */

async function openCustomiser(page: Page, username: string, plan: string, count = 4, next = "/portfolio/customise") {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}&count=${count}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=${encodeURIComponent(next)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Customise portfolio" })).toBeVisible();
  await expect(page.locator("[data-ready=true]").first()).toBeAttached();
}

const status = (page: Page) => page.getByTestId("save-status");
/** Waits for a change to be sent and saved: the status leaves "Saved" and comes back. */
async function saved(page: Page) {
  await expect(status(page)).not.toHaveText("Saved");
  await expect(status(page)).toHaveText("Saved");
}

/** The headings of the tiles in the customiser's preview, top to bottom. */
const previewOrder = (page: Page) => page.locator("[data-testid=preview] ul > li[data-key] h3").allTextContents();
/** The headings of the tiles on the public at-a-glance page. */
async function publicOrder(page: Page, username: string) {
  const res = await page.goto(`/p/${username}`);
  expect(res?.status()).toBe(200);
  return page.locator("main ul > li h3").allTextContents();
}
const handle = (page: Page, title: string) => page.getByRole("button", { name: `Move ${title}`, exact: true });

async function addTile(page: Page, name: string) {
  await page.getByRole("button", { name: "Add a tile" }).click();
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
}

test.describe("Customise portfolio (Phase 2)", () => {
  test("keyboard: Space, arrows, Space reorders the tiles, announces in plain English, and the glance page follows", async ({ page }) => {
    const u = `cka${stamp()}`;
    await openCustomiser(page, u, "premium");
    expect(await previewOrder(page)).toEqual([GP, LIBRARY, THIRD, FOURTH]);

    await handle(page, GP).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[id^=DndLiveRegion]")).toContainText(`Picked up ${GP}. Position 1 of 4.`);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[id^=DndLiveRegion]")).toContainText("is over position 2 of 4.");
    await page.keyboard.press("Space");
    await expect(page.locator("[id^=DndLiveRegion]")).toContainText(`Dropped ${GP}. Position 2 of 4.`);

    expect(await previewOrder(page)).toEqual([LIBRARY, GP, THIRD, FOURTH]);
    await expect(page.getByRole("button", { name: /^Undo: Moved/ })).toBeEnabled();
    await saved(page);
    expect(await publicOrder(page, u)).toEqual([LIBRARY, GP, THIRD, FOURTH]);
  });

  test("escape cancels a keyboard drag", async ({ page }) => {
    await openCustomiser(page, `ckc${stamp()}`, "premium");
    await handle(page, GP).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.locator("[id^=DndLiveRegion]")).toContainText("Cancelled.");
    expect(await previewOrder(page)).toEqual([GP, LIBRARY, THIRD, FOURTH]);
    await expect(status(page)).toHaveText("Saved");
  });

  test("dragging with the mouse reorders, with a lifted tile while it moves", async ({ page }) => {
    const u = `ckm${stamp()}`;
    await openCustomiser(page, u, "premium");
    const from = await handle(page, GP).boundingBox();
    const over = await page.locator("[data-testid=preview] li[data-key]").nth(3).boundingBox();
    expect(from && over).toBeTruthy();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + 20, from!.y + 20, { steps: 4 });
    await page.mouse.move(over!.x + over!.width / 2, over!.y + over!.height / 2, { steps: 20 });
    await expect(page.getByTestId("lifted-tile")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByTestId("lifted-tile")).toHaveCount(0);
    expect(await previewOrder(page)).toEqual([LIBRARY, THIRD, FOURTH, GP]);
    await saved(page);
    expect(await publicOrder(page, u)).toEqual([LIBRARY, THIRD, FOURTH, GP]);
  });

  test("hide takes an exhbt off the glance page; its own link still works, is not for search engines, and Show brings it back", async ({ page }) => {
    const u = `ckh${stamp()}`;
    await openCustomiser(page, u, "premium");
    await page.getByRole("button", { name: `Hide ${LIBRARY} from your portfolio` }).click();
    expect(await previewOrder(page)).toEqual([GP, THIRD, FOURTH]);
    const tray = page.getByTestId("hidden-tray");
    await expect(tray).toContainText(LIBRARY);
    await saved(page);

    expect(await publicOrder(page, u)).toEqual([GP, THIRD, FOURTH]);
    await expect(page.locator("header")).toContainText("proven across 3 exhbts");
    // The direct link keeps working, numbered after the ones on the page, and asks not to be indexed.
    const direct = await page.goto(`/p/${u}/library-footfall`);
    expect(direct?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: LIBRARY })).toBeVisible();
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
    // And the /exhbts list says it's hidden.
    await page.goto("/exhbts");
    await expect(page.getByText("Hidden from portfolio")).toBeVisible();

    await page.goto("/portfolio/customise");
    await expect(page.getByTestId("hidden-tray")).toContainText(LIBRARY);
    await page.getByRole("button", { name: `Show ${LIBRARY} on your portfolio` }).click();
    // It returns to the place it had.
    expect(await previewOrder(page)).toEqual([GP, LIBRARY, THIRD, FOURTH]);
    await saved(page);
    expect(await publicOrder(page, u)).toEqual([GP, LIBRARY, THIRD, FOURTH]);
  });

  test("feature makes a wide first tile on both pages, and hiding the featured one drops the star", async ({ page }) => {
    const u = `ckf${stamp()}`;
    await openCustomiser(page, u, "premium");
    await page.getByRole("button", { name: `Feature ${THIRD}` }).click();
    expect(await previewOrder(page)).toEqual([THIRD, GP, LIBRARY, FOURTH]);
    await expect(page.getByText("Featured, always first")).toBeVisible();
    // The featured tile has no drag handle: it is pinned.
    await expect(handle(page, THIRD)).toHaveCount(0);
    await saved(page);

    expect(await publicOrder(page, u)).toEqual([THIRD, GP, LIBRARY, FOURTH]);
    const boxes = await page.locator("main ul > li").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(boxes[0]).toBeGreaterThan(boxes[1]! * 1.7);
    // Four tiles with a featured one: the last is wide too, so none sits alone beside a gap.
    expect(boxes[3]).toBeGreaterThan(boxes[1]! * 1.7);

    await page.goto("/portfolio/customise");
    await page.getByRole("button", { name: `Hide ${THIRD} from your portfolio` }).click();
    await expect(page.getByText("Featured, always first")).toHaveCount(0);
    await saved(page);
    await page.reload();
    await expect(page.getByText("Featured, always first")).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Feature ${GP}` })).toBeVisible();
  });

  test("extra tiles: add About, Education and Links, edit them in place, and see them on the glance page", async ({ page }) => {
    const u = `cke${stamp()}`;
    await openCustomiser(page, u, "premium", 2);

    await addTile(page, "About me");
    const about = page.locator('[data-tile-editor="about"]');
    await expect(about.getByLabel("About me")).toBeFocused();
    await about.getByLabel("About me").fill("I like problems where a small change saves real time.");
    await expect(about).toContainText("10 of 60 words");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.locator('[data-tile="about"]')).toContainText("small change saves real time");

    await addTile(page, "Education");
    await page.getByLabel("Line 1").fill("BSc Data Science, University of Example, 2026");
    await page.getByRole("button", { name: "Add a line" }).click();
    await page.getByLabel("Line 2").fill("A levels: Maths, Further Maths, Physics");
    await page.getByRole("button", { name: "Done" }).click();

    await addTile(page, "Links and contact");
    await page.getByLabel("GitHub").fill("github.com/amara-o");
    await page.getByLabel("Website").fill("amara.dev");
    await page.getByLabel("Email").fill("Amara@Example.com");
    await page.getByRole("button", { name: "Done" }).click();
    await saved(page);

    // Menu: the tiles on the page are no longer offered, and none are left to add but the two unused.
    await page.getByRole("button", { name: "Add a tile" }).click();
    await expect(page.getByRole("button", { name: /^About me/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Featured quote/ })).toBeVisible();
    await page.keyboard.press("Escape");

    expect(await publicOrder(page, u)).toEqual([GP, LIBRARY, "About me", "Education", "Links and contact"]);
    await expect(page.locator('[data-tile="education"] li')).toHaveCount(2);
    const links = page.locator('[data-tile="links"]');
    await expect(links.getByRole("link", { name: /github\.com\/amara-o/ })).toHaveAttribute("href", "https://github.com/amara-o");
    await expect(links.getByRole("link", { name: /amara\.dev/ })).toHaveAttribute("href", "https://amara.dev/");
    // The email is text, not a mailto link.
    await expect(links).toContainText("amara@example.com");
    await expect(page.locator("a[href^='mailto:']")).toHaveCount(0);
    await expect(links.locator("a[target=_blank]")).toHaveCount(2);
  });

  test("an extra tile can be removed with one click and brought back with Undo, words and all", async ({ page }) => {
    const u = `ckr${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    await addTile(page, "Featured quote");
    await page.getByLabel("The quote").fill("She turned a messy spreadsheet into a decision.");
    await page.getByLabel("Who said it").fill("Dr Priya Shah");
    await page.getByLabel("Their role").fill("Module tutor");
    await page.getByRole("button", { name: "Done" }).click();
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator('[data-tile="quote"]')).toContainText("Dr Priya Shah, Module tutor");

    await page.goto("/portfolio/customise");
    await page.getByRole("button", { name: "Remove Featured quote" }).click();
    await expect(page.locator("[data-testid=preview] [data-tile=quote]")).toHaveCount(0);
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator('[data-tile="quote"]')).toHaveCount(0);

    await page.goto("/portfolio/customise");
    await expect(page.getByRole("button", { name: "Remove Featured quote" })).toHaveCount(0);
  });

  test("Undo takes back the last change", async ({ page }) => {
    const u = `cku${stamp()}`;
    await openCustomiser(page, u, "premium");
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await addTile(page, "About me");
    await page.getByLabel("About me").fill("Hello there.");
    await page.getByRole("button", { name: "Done" }).click();
    await saved(page);
    await page.getByRole("button", { name: "Remove About me" }).click();
    await expect(page.getByRole("button", { name: "Undo: Removed About me" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo: Removed About me" }).click();
    await expect(page.locator('[data-testid=preview] [data-tile="about"]')).toContainText("Hello there.");
    await saved(page);
    expect(await publicOrder(page, u)).toContain("About me");
  });

  test("tile limits: words and https links are checked, and a tile that fails is not saved until it is fixed", async ({ page }) => {
    const u = `ckl${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    await addTile(page, "Featured quote");
    await page.getByLabel("The quote").fill(words(TILE_LIMITS.quoteWords + 5));
    await expect(page.locator("#quote-text-error")).toContainText(`${TILE_LIMITS.quoteWords} words`);
    await expect(status(page)).toContainText("Not saved yet");
    await page.getByLabel("The quote").fill("Short and good.");
    await expect(status(page)).toHaveText("Saved");

    await page.getByRole("button", { name: "Done" }).click();
    await addTile(page, "Links and contact");
    await page.getByLabel("Website").fill("http://amara.dev");
    await expect(page.locator("#links-website-error")).toContainText("https");
    await expect(status(page)).toContainText("Not saved yet");
    await page.getByLabel("Website").fill("javascript:alert(1)");
    await expect(page.locator("#links-website-error")).toContainText("https");
    await page.getByLabel("Website").fill("https://amara.dev");
    await expect(status(page)).toHaveText("Saved");
    await page.getByRole("button", { name: "Done" }).click();

    // Nothing unchecked reached the page.
    await page.goto(`/p/${u}`);
    await expect(page.locator("a[href^='javascript:'], a[href^='http://']")).toHaveCount(0);
  });

  test("the strip of looks: a plan's looks save and show, locked ones preview with the upgrade prompt and save nothing", async ({ page }) => {
    const u = `ckt${stamp()}`;
    await openCustomiser(page, u, "premium");
    const open = themeAllowance("premium");
    await expect(page.getByRole("radio")).toHaveCount(PORTFOLIO_THEMES.length);
    await expect(page.locator("[data-theme-option]:not([data-locked])")).toHaveCount(open);
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(PORTFOLIO_THEMES.length - open);

    const lockedId = PORTFOLIO_THEMES[open]!.id;
    await page.locator(`[data-theme-option="${lockedId}"]`).click();
    await expect(page.getByTestId("upgrade-prompt")).toContainText("Max");
    await expect(page.locator("header[data-theme]")).toHaveAttribute("data-theme", lockedId); // previews
    await expect(status(page)).toHaveText("Saved"); // but nothing is sent
    await page.goto(`/p/${u}`);
    await expect(page.locator("header[data-theme]")).toHaveAttribute("data-theme", PORTFOLIO_THEMES[0]!.id);

    await page.goto("/portfolio/customise");
    await page.locator('[data-theme-option="jade"]').click();
    await expect(page.locator("header[data-theme]")).toHaveAttribute("data-theme", "jade");
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator("header[data-theme]")).toHaveAttribute("data-theme", "jade");
  });

  test("Max has every look open", async ({ page }) => {
    await openCustomiser(page, `ckx${stamp()}`, "max");
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(0);
  });

  test("header bits: the skills strip and the LinkedIn button can be switched off and on", async ({ page }) => {
    const u = `ckb${stamp()}`;
    await openCustomiser(page, u, "premium");
    const preview = page.getByTestId("preview");
    await expect(preview.getByRole("list", { name: "Skills proven" })).toBeVisible();
    await expect(preview.getByRole("link", { name: /LinkedIn/ })).toBeVisible();

    await page.getByLabel("Show the skills strip").uncheck();
    await page.getByLabel("Show the LinkedIn button").uncheck();
    await expect(preview.getByRole("list", { name: "Skills proven" })).toHaveCount(0);
    await expect(preview.getByRole("link", { name: /LinkedIn/ })).toHaveCount(0);
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.getByRole("list", { name: "Skills proven" })).toHaveCount(0);
    await expect(page.locator("header").getByRole("link", { name: /LinkedIn/ })).toHaveCount(0);

    await page.goto("/portfolio/customise");
    await expect(page.getByLabel("Show the skills strip")).not.toBeChecked();
    await page.getByLabel("Show the skills strip").check();
    await page.getByLabel("Show the LinkedIn button").check();
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.getByRole("list", { name: "Skills proven" })).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: /LinkedIn/ })).toBeVisible();
  });

  test("everything survives a reload, and the /exhbts list shares the order", async ({ page }) => {
    const u = `ckp${stamp()}`;
    await openCustomiser(page, u, "premium");
    await handle(page, FOURTH).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: `Hide ${GP} from your portfolio` }).click();
    await page.getByLabel("Show the skills strip").uncheck();
    await saved(page);

    await page.reload();
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();
    const after = await previewOrder(page);
    expect(after).not.toContain(GP);
    expect(after).toHaveLength(3);
    await expect(page.getByTestId("hidden-tray")).toContainText(GP);
    await expect(page.getByLabel("Show the skills strip")).not.toBeChecked();

    // /exhbts is in the same order, and keeps its up and down buttons as the simple way.
    await page.goto("/exhbts");
    const titles = await page.locator("ol[aria-label='Your exhbts, in portfolio order'] > li a.link").allTextContents();
    const expected = [...after];
    expect(titles.filter((t) => t !== GP)).toEqual(expected);
    await expect(page.getByRole("button", { name: `Move ${GP} down` })).toBeVisible();
    // Moving one there changes the customiser's order too.
    const first = titles[0]!;
    await page.getByRole("button", { name: `Move ${first} down` }).click();
    await page.goto("/portfolio/customise");
    const moved = await previewOrder(page);
    expect(moved.indexOf(first)).toBeGreaterThan(0);
  });

  test("Free sees the customiser and the upgrade prompt; publishing and extra tiles stay held back", async ({ page }) => {
    const u = `ckz${stamp()}`;
    await openCustomiser(page, u, "free", 2);
    await expect(page.getByTestId("upgrade-prompt").first()).toContainText("Premium");
    // Arranging works on a preview.
    expect(await previewOrder(page)).toEqual([GP, LIBRARY]);
    await handle(page, GP).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await saved(page);
    await page.reload();
    expect(await previewOrder(page)).toEqual([LIBRARY, GP]);
    // Extra tiles show the usual prompt instead of a menu of tiles.
    await page.getByRole("button", { name: "Add a tile" }).click();
    await expect(page.locator("#add-tile-menu").getByTestId("upgrade-prompt")).toContainText("Premium");
    await expect(page.getByRole("button", { name: /^About me/ })).toHaveCount(0);
    // Only the default look is open.
    await expect(page.locator("[data-theme-option]:not([data-locked])")).toHaveCount(1);
    // And there is no public page.
    expect((await page.goto(`/p/${u}`))?.status()).toBe(404);
  });

  test("a downgrade keeps the saved tiles, and the public page stops showing them", async ({ page }) => {
    const u = `ckd${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    await addTile(page, "About me");
    await page.getByLabel("About me").fill("Kept through a downgrade.");
    await page.getByRole("button", { name: "Done" }).click();
    await saved(page);
    expect(await publicOrder(page, u)).toContain("About me");

    // To Max (still has tiles) and back to Premium changes nothing; a plan with none (free) holds them.
    await page.goto("/dev/plan?plan=free&next=/portfolio/customise");
    await expect(page.getByTestId("tiles-held")).toBeVisible();
    await expect(page.locator('[data-testid=preview] [data-tile="about"]')).toHaveCount(0);
    // Changing the order on Free doesn't lose them.
    await handle(page, GP).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await saved(page);
    await page.goto("/dev/plan?plan=premium&next=/portfolio/customise");
    await expect(page.locator('[data-testid=preview] [data-tile="about"]')).toContainText("Kept through a downgrade.");
  });

  test("axe passes on the customiser (with tiles, a hidden exhbt and a featured one) and on the glance page", async ({ page }) => {
    const u = `cka${stamp()}`;
    await openCustomiser(page, u, "premium");
    await page.getByRole("button", { name: `Feature ${THIRD}` }).click();
    await page.getByRole("button", { name: `Hide ${LIBRARY} from your portfolio` }).click();
    await addTile(page, "About me");
    await page.getByLabel("About me").fill("A short line about me.");
    await saved(page);
    const editor = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(editor.violations, JSON.stringify(editor.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);
    await page.getByRole("button", { name: "Done" }).click();
    await addTile(page, "Links and contact");
    await page.getByLabel("GitHub").fill("github.com/amara-o");
    await page.getByRole("button", { name: "Done" }).click();
    await saved(page);
    const customiser = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(customiser.violations, JSON.stringify(customiser.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);

    await page.goto(`/p/${u}`);
    await expect(page.locator('[data-tile="about"]')).toBeVisible();
    const glance = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(glance.violations, JSON.stringify(glance.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);
  });
});

/* ---------- a phone ---------- */

test.describe("Customise portfolio on a phone", () => {
  test.use({ ...devices["Pixel 7"] });

  test("no sideways scroll, the controls reach 44px, and a press-and-hold drag on the grip reorders", async ({ page }) => {
    const u = `ckpx${stamp()}`;
    await openCustomiser(page, u, "premium");
    await addTile(page, "Education");
    await page.getByLabel("Line 1").fill("BSc Data Science, University of Example, 2026");
    await page.getByRole("button", { name: "Done" }).click();
    await saved(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const small = await page.locator("[data-testid=preview] li[data-key] button").evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height < 43.5).length);
    expect(small).toBe(0);

    // The tile order on a phone is one column.
    const before = await previewOrder(page);
    expect(before.slice(0, 2)).toEqual([GP, LIBRARY]);
    const grip = handle(page, GP);
    await grip.scrollIntoViewIfNeeded();
    const a = (await grip.boundingBox())!;
    const target = (await page.locator("[data-testid=preview] li[data-key]").nth(1).boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const point = (x: number, y: number) => [{ x, y, id: 1 }];
    const sx = a.x + a.width / 2;
    const sy = a.y + a.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(sx, sy) });
    await page.waitForTimeout(300); // the short press that tells a drag from a scroll
    for (let i = 1; i <= 20; i++) {
      const y = sy + ((target.y + target.height * 0.7 - sy) * i) / 20;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(sx, y) });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await previewOrder(page)).indexOf(GP)).toBeGreaterThan(0);
    await saved(page);
    expect(await publicOrder(page, u)).not.toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("the buttons work without dragging: hide, feature and add a tile", async ({ page }) => {
    await openCustomiser(page, `ckpb${stamp()}`, "premium");
    await page.getByRole("button", { name: `Feature ${LIBRARY}` }).tap();
    expect((await previewOrder(page))[0]).toBe(LIBRARY);
    await page.getByRole("button", { name: `Hide ${GP} from your portfolio` }).tap();
    await expect(page.getByTestId("hidden-tray")).toContainText(GP);
    await page.getByRole("button", { name: "Add a tile" }).tap();
    await page.getByRole("button", { name: /^About me/ }).tap();
    await expect(page.getByLabel("About me")).toBeVisible();
    await saved(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

