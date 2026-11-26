import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { ENTITLEMENTS } from "../lib/entitlements";
import { sampleDocs } from "../lib/exhbt/sample";
import { canUseExtraTiles, customisableExhbts, listedOnPortfolio } from "../lib/plan-rules";
import { checkTiles } from "../lib/portfolio-customise";
import {
  DEFAULT_LAYOUT,
  DEFAULT_SECTIONS,
  layoutFromOrder,
  layoutFromSections,
  sectionsOf,
  splitYear,
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

// The portfolio customiser (decision 0014), now the Projects and Look steps of the portfolio builder
// (decision 0016): the layout rules, the steps, and the public at-a-glance page that renders what
// they save. Plans are set with the dev override
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
      tiles: {
        about: { text: "Hi" },
        education: { lines: ["Shown under About me"] },
        experience: { lines: ["Not on the page"] },
        quote: { text: "Good", name: "A", role: "B" },
      },
      header: { skills: false },
    });
    expect(layout.slots).toEqual(["p", "about", "p", "p", "quote"]);
    // Education is part of About me on the home page (decision 0016), so it stays while About me does.
    expect(layout.tiles.education).toEqual({ lines: ["Shown under About me"] });
    expect(layout.tiles.experience).toBeUndefined();
    expect(layout.header).toEqual({ skills: false, linkedin: true });
    expect(sequence(layout, ["a", "b", "c"])).toEqual(["a", "about", "b", "c", "quote"]);
    // More exhbts than slots: the rest go on the end. Fewer: spare slots are dropped.
    expect(sequence(layout, ["a", "b", "c", "d"])).toEqual(["a", "about", "b", "c", "quote", "d"]);
    expect(sequence(layout, ["a"])).toEqual(["a", "about", "quote"]);
    expect(splitOrder(["a", "about", "b"])).toEqual({ slots: ["p", "about", "p"], projectIds: ["a", "b"] });
    expect(layoutFromOrder(["a", "about"], { about: { text: "x" }, quote: { text: "y", name: "", role: "" } }, DEFAULT_LAYOUT.header).tiles).toEqual({ about: { text: "x" } });
  });

  test("the home page's sections: an old customiser layout reads as the default plus its extra tiles; a new one as saved", () => {
    expect(sectionsOf(normaliseLayout(null))).toEqual([...DEFAULT_SECTIONS]);
    expect(sectionsOf(normaliseLayout({ v: 1, slots: ["p", "quote", "p", "about"], tiles: {}, header: {} }))).toEqual(["featured", "work", "about", "quote", "contact"]);
    const saved = layoutFromSections(["about", "featured", "quote"], { about: { text: "x" }, quote: { text: "y", name: "", role: "" }, experience: { lines: ["gone"] } }, DEFAULT_LAYOUT.header);
    expect(saved.slots).toEqual(["about", "featured", "quote"]);
    expect(saved.tiles.experience).toBeUndefined();
    expect(sectionsOf(normaliseLayout(saved))).toEqual(["about", "featured", "quote"]);
    expect(splitYear("MSc Finance, St Andrews, 2026")).toEqual({ label: "MSc Finance, St Andrews", year: "2026" });
    expect(splitYear("Retail supervisor, 2023 to 2025")).toEqual({ label: "Retail supervisor", year: "2023 to 2025" });
    expect(splitYear("Analyst intern, Example Bank, 2024–2025")).toEqual({ label: "Analyst intern, Example Bank", year: "2024–2025" });
    expect(splitYear("BA Economics")).toEqual({ label: "BA Economics", year: null });
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
    // The year at a line's end is not one of its words: the limit is the words a person sees, and the year besides.
    expect(bad({ education: { lines: [`${words(TILE_LIMITS.lineWords)}, 2026`] } })).toBe(false);
    expect(bad({ education: { lines: [`${words(TILE_LIMITS.lineWords + 1)}, 2026`] } })).toBe(true);
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

async function openCustomiser(page: Page, username: string, plan: string, count = 4, next = "/portfolio?step=projects") {
  const res = await page.request.get(`/dev/portfolio?username=${username}&plan=${plan}&count=${count}`, { maxRedirects: 0 });
  expect(res.status(), await res.text()).toBe(307);
  await page.goto(`/auth/dev?email=${encodeURIComponent(`${username}@example.com`)}&next=${encodeURIComponent(next)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
  await expect(page.locator("[data-ready=true]").first()).toBeAttached();
}

const status = (page: Page) => page.getByTestId("save-status");
/** Waits for a change to be sent and saved: the status leaves "Saved" and comes back. */
async function saved(page: Page) {
  await expect(status(page)).not.toHaveText("Saved");
  await expect(status(page)).toHaveText("Saved");
}

/** The exhbts on a home page, top to bottom: the one in the band, then the cards (decision 0016). */
const projectTitles = (scope: string) => (page: Page) =>
  page.locator(`${scope} [data-section=featured] h2, ${scope} [data-card] h3`).allTextContents();
/** The exhbts in the builder's preview. */
const previewOrder = projectTitles("[data-testid=preview]");
/** The exhbts on the public home page. */
async function publicOrder(page: Page, username: string) {
  const res = await page.goto(`/p/${username}`);
  expect(res?.status()).toBe(200);
  return projectTitles("main")(page);
}
/** The sections below the hero, top to bottom. */
const sectionOrder = (page: Page, scope = "[data-testid=preview]") =>
  page.locator(`${scope} [data-section]`).evaluateAll((els) => els.map((el) => el.getAttribute("data-section")));
const handle = (page: Page, title: string) => page.getByRole("button", { name: `Move ${title}`, exact: true });

/**
 * Picks a tile up with Space, presses the arrows, and drops it with Space. Waits for each
 * announcement, as a person would, so the drag has measured the tiles before the next key.
 */
async function keyboardMove(page: Page, title: string, arrows: string[]) {
  const live = page.locator("[id^=DndLiveRegion]:not(:empty)");
  await handle(page, title).focus();
  await page.keyboard.press("Space");
  await expect(live).toContainText("Picked up");
  for (const key of arrows) {
    await page.keyboard.press(key);
    await expect(live).toContainText(/is over position/);
    await page.waitForTimeout(120);
  }
  await page.keyboard.press("Space");
  await expect(live).toContainText("Dropped");
}

/** The rows of the Projects step, top to bottom. */
const rows = (page: Page) => page.locator("[data-testid=tile-list] > li");

async function addSection(page: Page, name: string) {
  await page.getByRole("button", { name: "Add a section" }).click();
  await page.locator("#add-section-menu").getByRole("button", { name: new RegExp(`^${name}`) }).click();
}

test.describe("Arrange the portfolio (builder, Projects and Look)", () => {
  test("keyboard: Space, arrows, Space reorders the tiles, announces in plain English, and the glance page follows", async ({ page }) => {
    const u = `cka${stamp()}`;
    await openCustomiser(page, u, "premium");
    expect(await previewOrder(page)).toEqual([GP, LIBRARY, THIRD, FOURTH]);

    await handle(page, GP).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText(`Picked up ${GP}. Position 1 of 4.`);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText("is over position 2 of 4.");
    await page.keyboard.press("Space");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText(`Dropped ${GP}. Position 2 of 4.`);

    expect(await previewOrder(page)).toEqual([LIBRARY, GP, THIRD, FOURTH]);
    await expect(page.getByRole("button", { name: /^Undo: Moved/ })).toBeEnabled();
    await saved(page);
    expect(await publicOrder(page, u)).toEqual([LIBRARY, GP, THIRD, FOURTH]);
  });

  test("escape cancels a keyboard drag", async ({ page }) => {
    await openCustomiser(page, `ckc${stamp()}`, "premium");
    await handle(page, GP).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText("Picked up");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText("is over position");
    await page.keyboard.press("Escape");
    await expect(page.locator("[id^=DndLiveRegion]:not(:empty)")).toContainText("Cancelled.");
    expect(await previewOrder(page)).toEqual([GP, LIBRARY, THIRD, FOURTH]);
    await expect(status(page)).toHaveText("Saved");
  });

  test("dragging with the mouse reorders, with a lifted tile while it moves", async ({ page }) => {
    const u = `ckm${stamp()}`;
    // Tall enough to have the first and last tiles on screen at once.
    await page.setViewportSize({ width: 1440, height: 2000 });
    await openCustomiser(page, u, "premium");
    const from = await handle(page, GP).boundingBox();
    const over = await rows(page).nth(3).boundingBox();
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
    await expect(page.locator("[data-portfolio-home] header")).toBeVisible();
    // The direct link keeps working, numbered after the ones on the page, and asks not to be indexed.
    const direct = await page.goto(`/p/${u}/library-footfall`);
    expect(direct?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: LIBRARY })).toBeVisible();
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
    // And the /exhbts list says it's hidden.
    await page.goto("/exhbts");
    await expect(page.getByText("Hidden from portfolio")).toBeVisible();

    await page.goto("/portfolio?step=projects");
    await expect(page.getByTestId("hidden-tray")).toContainText(LIBRARY);
    await page.getByRole("button", { name: `Show ${LIBRARY} on your portfolio` }).click();
    // It returns to the place it had.
    expect(await previewOrder(page)).toEqual([GP, LIBRARY, THIRD, FOURTH]);
    await saved(page);
    expect(await publicOrder(page, u)).toEqual([GP, LIBRARY, THIRD, FOURTH]);
  });

  test("feature puts an exhbt in the band on both pages, and hiding the featured one drops the star", async ({ page }) => {
    const u = `ckf${stamp()}`;
    await openCustomiser(page, u, "premium");
    await page.getByRole("button", { name: `Feature ${THIRD}` }).click();
    expect(await previewOrder(page)).toEqual([THIRD, GP, LIBRARY, FOURTH]);
    await expect(page.getByText("Featured, always first")).toBeVisible();
    // The featured tile has no drag handle: it is pinned.
    await expect(handle(page, THIRD)).toHaveCount(0);
    await saved(page);

    expect(await publicOrder(page, u)).toEqual([THIRD, GP, LIBRARY, FOURTH]);
    await expect(page.locator("[data-section=featured] h2")).toHaveText(THIRD);
    await expect(page.locator("[data-section=featured]").getByRole("link", { name: "See how I did it" })).toHaveAttribute("href", `/p/${u}/project-3`);

    await page.goto("/portfolio?step=projects");
    await page.getByRole("button", { name: `Hide ${THIRD} from your portfolio` }).click();
    await expect(page.getByText("Featured, always first")).toHaveCount(0);
    await saved(page);
    await page.reload();
    await expect(page.getByText("Featured, always first")).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Feature ${GP}` })).toBeVisible();
  });

  test("sections: add Experience and a quote, fill in About me with education and tools, and see them on the home page", async ({ page }) => {
    const u = `cke${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    expect(await sectionOrder(page)).toEqual(["featured", "work", "about", "contact"]);

    await page.getByRole("button", { name: "Edit About me" }).click();
    await page.locator("#about-text").fill("I like problems where a small change saves real time.");
    await page.locator("#education-line-0").fill("BSc Data Science, University of Example, 2026");
    await page.locator("#education-tools").fill("Python, SQL");

    await addSection(page, "Experience");
    await page.locator("#experience-line-0").fill("Retail supervisor, Example Stores, 2023 to 2025");
    await addSection(page, "A quote");
    await page.getByLabel("The quote").fill("She turned a messy spreadsheet into a decision.");
    await page.getByLabel("Who said it").fill("Dr Priya Shah");
    await page.getByLabel("Their role").fill("Module tutor");
    await saved(page);
    expect(await sectionOrder(page)).toEqual(["featured", "work", "about", "contact", "experience", "quote"]);

    // Every section is on the page, so there's nothing left to add.
    await expect(page.getByRole("button", { name: "Add a section" })).toBeDisabled();

    await page.goto(`/p/${u}`);
    expect(await sectionOrder(page, "main")).toEqual(["featured", "work", "about", "contact", "experience", "quote"]);
    const about = page.locator("[data-section=about]");
    await expect(about).toContainText("small change saves real time");
    await expect(about.getByText("BSc Data Science, University of Example")).toBeVisible();
    await expect(about.getByText("2026")).toBeVisible();
    await expect(about).toContainText("Python, SQL");
    await expect(page.locator("[data-section=quote]")).toContainText("Dr Priya Shah, Module tutor");
  });

  test("sections drag in the preview: Space, arrows, Space moves one, and the home page follows", async ({ page }) => {
    const u = `cks${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    await page.getByRole("button", { name: "Edit About me" }).click();
    await page.locator("#about-text").fill("A line about me.");
    await saved(page);
    const live = page.locator("[id^=DndLiveRegion]:not(:empty)");
    await page.getByRole("button", { name: "Move About me", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(live).toContainText("Picked up About me. Position 3 of 4.");
    await page.keyboard.press("ArrowUp");
    await expect(live).toContainText("is over position 2 of 4");
    await page.waitForTimeout(120);
    await page.keyboard.press("ArrowUp");
    await expect(live).toContainText("is over position 1 of 4");
    await page.waitForTimeout(120);
    await page.keyboard.press("Space");
    await expect(live).toContainText("Dropped About me. Position 1 of 4.");
    await expect(page.getByTestId("lifted-section")).toHaveCount(0);
    await expect.poll(() => sectionOrder(page)).toEqual(["about", "featured", "work", "contact"]);
    await expect(page.getByRole("button", { name: "Undo: Moved About me" })).toBeEnabled();
    await saved(page);
    await page.goto(`/p/${u}`);
    expect(await sectionOrder(page, "main")).toEqual(["about", "featured", "work", "contact"]);
  });

  test("a section comes off the page with one click and back with Undo, words and all", async ({ page }) => {
    const u = `ckr${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    await addSection(page, "A quote");
    await page.getByLabel("The quote").fill("She turned a messy spreadsheet into a decision.");
    await page.getByLabel("Who said it").fill("Dr Priya Shah");
    await saved(page);

    await page.getByTestId("preview").getByRole("button", { name: "Remove A quote" }).click();
    await expect(page.locator("[data-testid=preview] [data-section=quote]")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo: Removed A quote" }).click();
    await expect(page.locator("[data-testid=preview] [data-section=quote]")).toContainText("Dr Priya Shah");
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator("[data-section=quote]")).toContainText("messy spreadsheet");

    await page.goto("/portfolio?step=projects");
    await page.getByRole("button", { name: "Take A quote off the page" }).click();
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator("[data-section=quote]")).toHaveCount(0);
  });

  test("limits: words are checked, links must be https, and a field that fails is not saved until it is fixed", async ({ page }) => {
    const u = `ckl${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    await addSection(page, "A quote");
    await page.getByLabel("The quote").fill(words(TILE_LIMITS.quoteWords + 5));
    await expect(page.locator("#quote-text-error")).toContainText(`${TILE_LIMITS.quoteWords} words`);
    await expect(status(page)).toContainText("Not saved yet");
    await page.getByLabel("The quote").fill("Short and good.");
    await expect(status(page)).toHaveText("Saved");

    await page.goto("/portfolio?step=you");
    await page.getByLabel(/Website/).fill("http://amara.dev");
    await expect(page.locator("#you-website-error")).toContainText("https");
    await expect(status(page)).toContainText("Not saved yet");
    await page.getByLabel(/Website/).fill("javascript:alert(1)");
    await expect(page.locator("#you-website-error")).toContainText("https");
    await page.getByLabel(/Website/).fill("https://amara.dev");
    await expect(status(page)).toHaveText("Saved");

    await page.goto(`/p/${u}`);
    await expect(page.locator("a[href^='javascript:'], a[href^='http://']")).toHaveCount(0);
    await expect(page.locator("[data-section=contact]").getByRole("link", { name: /amara\.dev/ })).toHaveAttribute("href", "https://amara.dev/");
  });

  test("the looks: a plan's looks save and show, locked ones preview with the upgrade prompt and save nothing", async ({ page }) => {
    const u = `ckt${stamp()}`;
    await openCustomiser(page, u, "premium", 4, "/portfolio?step=look");
    const open = themeAllowance("premium");
    await expect(page.locator("input[name=themeId]")).toHaveCount(PORTFOLIO_THEMES.length);
    await expect(page.locator("[data-theme-option]:not([data-locked])")).toHaveCount(open);
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(PORTFOLIO_THEMES.length - open);

    const lockedId = PORTFOLIO_THEMES[open]!.id;
    await page.locator(`[data-theme-option="${lockedId}"]`).click();
    await expect(page.locator("section[aria-labelledby=step-heading]").getByTestId("upgrade-prompt")).toContainText("Max");
    await expect(page.locator("[data-testid=preview] [data-portfolio-home]")).toHaveAttribute("data-theme", lockedId); // previews
    await expect(status(page)).toHaveText("Saved"); // but nothing is sent
    await page.goto(`/p/${u}`);
    await expect(page.locator("[data-portfolio-home]")).toHaveAttribute("data-theme", PORTFOLIO_THEMES[0]!.id);

    await page.goto("/portfolio?step=look");
    await page.locator('[data-theme-option="classic"]').click();
    await expect(page.locator("[data-testid=preview] [data-portfolio-home]")).toHaveAttribute("data-theme", "classic");
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator("[data-portfolio-home]")).toHaveAttribute("data-theme", "classic");
  });

  test("Max has every look open", async ({ page }) => {
    await openCustomiser(page, `ckx${stamp()}`, "max", 4, "/portfolio?step=look");
    await expect(page.locator("[data-theme-option][data-locked]")).toHaveCount(0);
  });

  test("LinkedIn can be left off the page and put back", async ({ page }) => {
    const u = `ckb${stamp()}`;
    await openCustomiser(page, u, "premium", 4, "/portfolio?step=you");
    const contact = page.locator("[data-testid=preview] [data-section=contact]");
    await expect(contact.getByRole("link", { name: /linkedin/i })).toBeAttached();

    await page.getByLabel("Show it on my page").uncheck();
    // With nothing else to show, Get in touch is empty and visitors won't see it.
    await expect(contact.getByRole("link", { name: /linkedin/i })).toHaveCount(0);
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.getByRole("link", { name: /linkedin/i })).toHaveCount(0);

    await page.goto("/portfolio?step=you");
    await expect(page.getByLabel("Show it on my page")).not.toBeChecked();
    await page.getByLabel("Show it on my page").check();
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator("[data-section=contact]").getByRole("link", { name: /linkedin/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "#contact");
  });

  test("everything survives a reload, and the /exhbts list shares the order", async ({ page }) => {
    const u = `ckp${stamp()}`;
    await openCustomiser(page, u, "premium");
    await keyboardMove(page, FOURTH, ["ArrowUp"]);
    await page.getByRole("button", { name: `Hide ${GP} from your portfolio` }).click();
    await saved(page);

    await page.reload();
    await expect(page.locator("[data-ready=true]").first()).toBeAttached();
    const after = await previewOrder(page);
    expect(after).not.toContain(GP);
    expect(after).toHaveLength(3);
    await expect(page.getByTestId("hidden-tray")).toContainText(GP);

    // /exhbts is in the same order, and keeps its up and down buttons as the simple way.
    await page.goto("/exhbts");
    const titles = await page.locator("ol[aria-label='Your exhbts, in portfolio order'] > li a.link").allTextContents();
    const expected = [...after];
    expect(titles.filter((t) => t !== GP)).toEqual(expected);
    await expect(page.getByRole("button", { name: `Move ${GP} down` })).toBeVisible();
    // Moving one there changes the builder's order too.
    const first = titles.find((t) => t !== GP)!;
    await page.getByRole("button", { name: `Move ${first} down` }).click();
    // Wait for the list to show the move before leaving, so the save has landed.
    const list = page.locator("ol[aria-label='Your exhbts, in portfolio order'] > li a.link");
    await expect.poll(async () => (await list.allTextContents()).indexOf(first)).toBeGreaterThan(titles.indexOf(first));
    await page.goto("/portfolio?step=projects");
    const moved = await previewOrder(page);
    expect(moved.indexOf(first)).toBeGreaterThan(0);
  });

  test("Free sees the page step and the upgrade prompt; publishing and the extra sections stay held back", async ({ page, browser }) => {
    const u = `ckz${stamp()}`;
    await openCustomiser(page, u, "free", 2);
    await expect(page.getByTestId("upgrade-prompt").first()).toContainText("Premium");
    // Arranging works on a preview.
    expect(await previewOrder(page)).toEqual([GP, LIBRARY]);
    await keyboardMove(page, GP, ["ArrowDown"]);
    await saved(page);
    await page.reload();
    expect(await previewOrder(page)).toEqual([LIBRARY, GP]);
    // Experience and a quote show the usual prompt instead of being added.
    await page.getByRole("button", { name: "Add a section" }).click();
    await expect(page.locator("#add-section-menu").getByTestId("upgrade-prompt").first()).toContainText("Premium");
    await expect(page.locator("#add-section-menu").getByRole("button", { name: /^Experience/ })).toHaveCount(0);
    // Only the default look is open.
    await page.goto("/portfolio?step=look");
    await expect(page.locator("[data-theme-option]:not([data-locked])")).toHaveCount(1);
    // And there is no public page: the owner sees a preview, a visitor gets not found.
    await page.goto(`/p/${u}`);
    await expect(page.getByTestId("owner-preview")).toContainText("Premium");
    const visitor = await browser.newPage();
    expect((await visitor.goto(`/p/${u}`))?.status()).toBe(404);
    await visitor.close();
  });

  test("a downgrade keeps the saved extra sections, and the home page stops showing them", async ({ page }) => {
    const u = `ckd${stamp()}`;
    await openCustomiser(page, u, "premium", 2);
    await addSection(page, "Experience");
    await page.locator("#experience-line-0").fill("Kept through a downgrade.");
    await saved(page);
    await page.goto(`/p/${u}`);
    await expect(page.locator("[data-section=experience]")).toContainText("Kept through a downgrade.");

    await page.goto("/dev/plan?plan=free&next=%2Fportfolio%3Fstep%3Dprojects");
    await expect(page.getByTestId("tiles-held")).toBeVisible();
    await expect(page.locator("[data-testid=preview] [data-section=experience]")).toHaveCount(0);
    // Changing the order on Free doesn't lose it.
    await keyboardMove(page, GP, ["ArrowDown"]);
    await saved(page);
    await page.goto("/dev/plan?plan=premium&next=%2Fportfolio%3Fstep%3Dprojects");
    await expect(page.locator("[data-testid=preview] [data-section=experience]")).toContainText("Kept through a downgrade.");
  });

  test("axe passes on the page step (with sections, a hidden exhbt and a featured one) and on the home page", async ({ page }) => {
    const u = `cka${stamp()}`;
    await openCustomiser(page, u, "premium");
    await page.getByRole("button", { name: `Feature ${THIRD}` }).click();
    await page.getByRole("button", { name: `Hide ${LIBRARY} from your portfolio` }).click();
    await addSection(page, "Experience");
    await page.locator("#experience-line-0").fill("Retail supervisor, 2023 to 2025");
    await saved(page);
    const editing = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(editing.violations, JSON.stringify(editing.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);

    await page.goto(`/p/${u}`);
    await expect(page.locator("[data-section=experience]")).toBeVisible();
    const home = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(home.violations, JSON.stringify(home.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);
  });
});

/* ---------- a phone ---------- */

test.describe("Arrange the portfolio on a phone", () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("no sideways scroll, the controls reach 44px, and a press-and-hold drag on the grip reorders", async ({ page }) => {
    const u = `ckpx${stamp()}`;
    await openCustomiser(page, u, "premium");
    await addSection(page, "Experience");
    await page.locator("#experience-line-0").fill("Retail supervisor, 2023 to 2025");
    await saved(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const small = await page.locator("[data-testid=tile-list] button, [data-testid=tile-list] a").evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height < 43.5).length);
    expect(small).toBe(0);

    // The tile order on a phone is one column.
    const before = await previewOrder(page);
    expect(before.slice(0, 2)).toEqual([GP, LIBRARY]);
    const grip = handle(page, GP);
    await grip.scrollIntoViewIfNeeded();
    const a = (await grip.boundingBox())!;
    const target = (await rows(page).nth(1).boundingBox())!;
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
    await page.getByRole("button", { name: "Add a section" }).tap();
    await page.locator("#add-section-menu").getByRole("button", { name: /^Experience/ }).tap();
    await expect(page.locator("#experience-line-0")).toBeVisible();
    await saved(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

