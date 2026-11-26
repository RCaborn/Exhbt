import AxeBuilder from "@axe-core/playwright";
import { FULL, SPARSE, fullFixture, sparseFixture } from "./fixtures/portfolio-pages";
import type { Page } from "@playwright/test";
import { applyUndo, entryFor } from "../components/portfolio-editor/undo";
import type { BuilderState } from "../app/(app)/portfolio/steps";
import { HOME, READY, boxes, call, changeWith, differences, expect, field, focusedPath, renders, fresh, openEditor, saveState, seed, setKind, settle, signIn, stateNow, test, textbox, typeIn, uiNow, undoLabel, valueAt, waitReady, waitSaved } from "./portfolio-editor";

// The one-page portfolio editor's core (decision 0031; brief E of docs/briefs/portfolio-first): which
// builder a person gets, the page drawn as the visitor's with every word typed where it sits, each field
// stored at its path, a line's two halves saved as one line, and the crash fallback. Each test seeds a
// portfolio of its own through /dev/portfolio-parity and opts its own browser in with the development
// cookie (the switch is at "steps" for everyone).

const STEP_BUILDER = { level: 1, name: "Build your portfolio" } as const;

test.describe("Which builder a person gets", () => {
  test("with the switch as it ships, /portfolio is the step builder, exactly as before", async ({ page }) => {
    const f = fresh(FULL, "steps");
    await seed(page, f);
    await signIn(page, f.username);
    await expect(page.getByRole("heading", STEP_BUILDER)).toBeVisible();
    await expect(page.locator("nav[aria-label=Steps] a[aria-current=step]")).toHaveText(/You/);
    await expect(page.getByTestId("preview").locator(HOME)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Job links" })).toBeVisible();
    await expect(page).toHaveTitle(/Build your portfolio/);
    // Nothing of the editor is on the page, and nobody who is not an admin is offered it.
    await expect(page.locator("[data-editor]")).toHaveCount(0);
    await expect(page.locator("[data-admin-switch]")).toHaveCount(0);
    // ?step= is read as it always was.
    await page.goto("/portfolio?step=look");
    await expect(page.locator("nav[aria-label=Steps] a[aria-current=step]")).toHaveText(/Your look/);
  });

  test("with the switch at page, /portfolio is the person's own page, edited where it sits", async ({ page }) => {
    const f = fresh(FULL, "page");
    await openEditor(page, f);
    await expect(page).toHaveTitle(/Your portfolio/);
    await expect(page.getByRole("heading", { level: 1, name: "Your portfolio" })).toBeVisible();
    await expect(page.getByRole("heading", STEP_BUILDER)).toHaveCount(0);
    // The page is the visitor's page, in the person's look, with the name a field in its own heading.
    const home = page.locator(`${READY} ${HOME}`);
    await expect(home).toHaveAttribute("data-look", "exhbt");
    await expect(home.locator("h1").getByRole("textbox", { name: "Your name" })).toHaveValue("Maya Clarke");
    await expect(home.locator("[data-section]")).toHaveCount(6);
    await expect(home.locator("[data-card]")).toHaveCount(4);
    // The page's own links cannot be followed while it is being edited.
    await expect(home.locator("nav[aria-label=Portfolio]")).toHaveAttribute("inert", "");
    await expect(saveState(page)).toHaveAttribute("data-save", "saved");
  });

  test("?builder=steps serves the step builder whatever the switch says", async ({ page }) => {
    const f = fresh(FULL, "escape");
    await openEditor(page, f);
    await page.goto("/portfolio?builder=steps");
    await expect(page.getByRole("heading", STEP_BUILDER)).toBeVisible();
    await expect(page.locator("[data-editor]")).toHaveCount(0);
    await expect(page).toHaveTitle(/Build your portfolio/);
    // It wins over what only the editor reads, and the step builder still reads its own step.
    await page.goto("/portfolio?builder=steps&open=look&step=projects");
    await expect(page.locator("nav[aria-label=Steps] a[aria-current=step]")).toHaveText(/Your page/);
    // Without it, the editor again.
    await page.goto("/portfolio");
    await waitReady(page);
  });

  test("an admin on the step builder is offered the new portfolio, and taking it serves the editor from then on", async ({ page }) => {
    const f = fresh(FULL, "admin");
    await seed(page, f);
    await signIn(page, f.username);
    await expect(page.getByRole("heading", STEP_BUILDER)).toBeVisible();
    await expect(page.locator("[data-admin-switch]")).toHaveCount(0);
    expect((await page.request.get("/dev/admin?role=admin")).status()).toBe(200);
    await page.reload();
    const offer = page.locator("[data-admin-switch]");
    await expect(offer).toContainText("Admins only");
    await offer.getByRole("button", { name: "Try the new portfolio" }).click();
    await waitReady(page);
    await expect(page).toHaveURL(/\/portfolio$/);
    // Their own choice holds on the next visit, and the address still takes them back for one.
    await page.goto("/portfolio");
    await waitReady(page);
    await page.goto("/portfolio?builder=steps");
    await expect(page.getByRole("heading", STEP_BUILDER)).toBeVisible();
    await expect(page.locator("[data-admin-switch]")).toBeVisible();
  });
});

test.describe("Typing on the page", () => {
  /** Every field of decision 0031's table that is typed on the page, with words the server keeps as they are. */
  const WORDS: { path: string; part?: "label" | "year"; words: string }[] = [
    { path: "profile.name", words: "Jordan Mensah" },
    { path: "profile.headline", words: "Graduate data analyst, transport and cities" },
    { path: "profile.bio", words: "I studied Geography at Leeds and taught myself Python.\n\nI like work where a map changes a decision." },
    { path: "profile.location", words: "Leeds" },
    { path: "profile.lookingFor", words: "Graduate data roles from September" },
    { path: "arrangement.tiles.about.text", words: "I map bus delays for fun, and I like a chart that changes a decision." },
    { path: "arrangement.tiles.education.lines.0", part: "label", words: "BSc Geography, University of Leeds" },
    { path: "arrangement.tiles.education.lines.0", part: "year", words: "2023 to 2026" },
    { path: "arrangement.tiles.education.tools", words: "Python, QGIS, SQL" },
    { path: "arrangement.tiles.experience.lines.1", part: "label", words: "Data volunteer, Leeds Bus Users" },
    { path: "arrangement.tiles.experience.lines.1", part: "year", words: "2025" },
    { path: "arrangement.tiles.quote.text", words: "Jordan's maps changed where we put the new stops." },
    { path: "arrangement.tiles.quote.name", words: "Priya Shah" },
    { path: "arrangement.tiles.quote.role", words: "Network planner" },
  ];
  /** What the state holds at each path once those words are typed. */
  const STORED: Record<string, string> = {
    "profile.name": "Jordan Mensah",
    "profile.headline": "Graduate data analyst, transport and cities",
    "profile.bio": "I studied Geography at Leeds and taught myself Python.\n\nI like work where a map changes a decision.",
    "profile.location": "Leeds",
    "profile.lookingFor": "Graduate data roles from September",
    "arrangement.tiles.about.text": "I map bus delays for fun, and I like a chart that changes a decision.",
    "arrangement.tiles.education.lines.0": "BSc Geography, University of Leeds, 2023 to 2026",
    "arrangement.tiles.education.tools": "Python, QGIS, SQL",
    "arrangement.tiles.experience.lines.1": "Data volunteer, Leeds Bus Users, 2025",
    "arrangement.tiles.quote.text": "Jordan's maps changed where we put the new stops.",
    "arrangement.tiles.quote.name": "Priya Shah",
    "arrangement.tiles.quote.role": "Network planner",
  };

  test("every field is typed where it sits and is stored at its path after a reload", async ({ page }) => {
    test.slow();
    const f = fresh(FULL, "fields");
    await openEditor(page, f);
    for (const w of WORDS) {
      await typeIn(page, w.path, w.words, { part: w.part });
      // The cursor is still in the field it was typing in: nothing took it away mid-word.
      expect(await focusedPath(page), `after typing in ${w.path}`).toBe(w.path);
    }
    for (const [path, words] of Object.entries(STORED)) expect(await valueAt(page, path), path).toBe(words);
    await waitSaved(page);

    // A reload brings back what the server holds: every word, at its path.
    await page.reload();
    await waitReady(page);
    for (const [path, words] of Object.entries(STORED)) expect(await valueAt(page, path), `${path} after a reload`).toBe(words);
    // And on the page, in its place: the name in the heading, the intro as two paragraphs, a line as its two halves.
    await expect(page.locator(`${READY} ${HOME} h1`).getByRole("textbox", { name: "Your name" })).toHaveValue("Jordan Mensah");
    await expect(field(page, "profile.bio").locator("textarea")).toHaveCount(2);
    await expect(textbox(page, "arrangement.tiles.education.lines.0", { part: "label" })).toHaveValue("BSc Geography, University of Leeds");
    await expect(textbox(page, "arrangement.tiles.education.lines.0", { part: "year" })).toHaveValue("2023 to 2026");
    await expect(textbox(page, "arrangement.tiles.quote.name")).toHaveText("Priya Shah");

    // The step builder reads the same save.
    await page.goto("/portfolio?builder=steps");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Jordan Mensah");
    await expect(page.getByLabel(/Headline/)).toHaveValue("Graduate data analyst, transport and cities");
    await expect(page.getByLabel(/Where you’re based/)).toHaveValue("Leeds");
  });

  test("a line's two halves are saved as one line, and each stays as it is typed", async ({ page }) => {
    const f = fresh(FULL, "lines");
    await openEditor(page, f);
    const path = "arrangement.tiles.education.lines.1";
    const label = textbox(page, path, { part: "label" });
    const year = textbox(page, path, { part: "year" });
    // Run with E2E_GROW=mirror, the fields grow by their hidden mirror (portfolio-editor.ts).
    if (process.env.E2E_GROW === "mirror") await expect(page.locator(`${READY} [data-grow="mirror"]`).first()).toBeAttached();
    await expect(label).toHaveValue("Foundation year, Sheffield College");
    await expect(year).toHaveValue("2022–2023");
    // A line nobody has typed in keeps its own punctuation.
    expect(await valueAt(page, path)).toBe("Foundation year, Sheffield College, 2022–2023");

    // Words with spaces between them, key by key: a space at the end of the half is kept while it is typed.
    await typeIn(page, path, "MSc Data Science, University of Leeds", { part: "label" });
    await expect(label).toHaveValue("MSc Data Science, University of Leeds");
    expect(await valueAt(page, path)).toBe("MSc Data Science, University of Leeds, 2022–2023");
    await page.keyboard.type(" ");
    await expect(label).toHaveValue("MSc Data Science, University of Leeds ");
    await page.keyboard.press("Backspace");

    // A year typed digit by digit never shows in the words beside it, though the line only reads as a year at the end.
    await year.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    for (const key of "2027") {
      await page.keyboard.type(key);
      await expect(label).toHaveValue("MSc Data Science, University of Leeds");
    }
    await expect(year).toHaveValue("2027");
    expect(await valueAt(page, path)).toBe("MSc Data Science, University of Leeds, 2027");
    // The other lines were not touched.
    expect(await valueAt(page, "arrangement.tiles.education.lines.0")).toBe("BSc Business Analytics, University of Sheffield, 2023 to now");

    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect(await valueAt(page, path)).toBe("MSc Data Science, University of Leeds, 2027");
    await expect(textbox(page, path, { part: "label" })).toHaveValue("MSc Data Science, University of Leeds");
    await expect(textbox(page, path, { part: "year" })).toHaveValue("2027");
  });

  test("the intro is paragraphs: Enter starts one, Backspace joins two, and About me stays one", async ({ page }) => {
    const f = fresh(FULL, "paras");
    await openEditor(page, f);
    const bio = field(page, "profile.bio");
    const paras = bio.locator("textarea[data-para]");
    await expect(paras).toHaveCount(2);
    await expect(paras.nth(0)).toHaveAccessibleName("Your intro, paragraph 1 of 2");

    // Enter at the end of the last paragraph starts a third, with the cursor in it.
    await paras.nth(1).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await expect(paras).toHaveCount(3);
    await expect(paras.nth(2)).toBeFocused();
    await page.keyboard.type("A third thought.");
    expect(String(await valueAt(page, "profile.bio")).split("\n\n")).toHaveLength(3);

    // Enter in the middle of a paragraph splits it there.
    await paras.nth(2).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(7, 7));
    await page.keyboard.press("Enter");
    await expect(paras).toHaveCount(4);
    await expect(paras.nth(2)).toHaveValue("A third");
    await expect(paras.nth(3)).toHaveValue(" thought.");
    // Backspace at the start of a paragraph joins it to the one before, the cursor where they met.
    await page.keyboard.press("Backspace");
    await expect(paras).toHaveCount(3);
    await expect(paras.nth(2)).toHaveValue("A third thought.");
    await expect(paras.nth(2)).toBeFocused();
    expect(await paras.nth(2).evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(7);
    // The arrow keys walk from one paragraph to the next.
    await paras.nth(2).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
    await page.keyboard.press("ArrowLeft");
    await expect(paras.nth(1)).toBeFocused();

    // About me's words are one paragraph: Enter does nothing there.
    const about = field(page, "arrangement.tiles.about.text");
    await about.locator("textarea").click();
    await page.keyboard.press("Enter");
    await expect(about.locator("textarea")).toHaveCount(1);
    await expect(about.getByRole("textbox", { name: "About you" })).toBeVisible();

    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    await expect(field(page, "profile.bio").locator("textarea[data-para]")).toHaveCount(3);
    await expect(field(page, "profile.bio").locator("textarea[data-para]").nth(2)).toHaveValue("A third thought.");
  });

  test("an empty page shows each field's placeholder where its words go, and the first key fills it", async ({ page }) => {
    const f = fresh(SPARSE, "sparse");
    await openEditor(page, f);
    // Every field is there to type in, the empty ones too, each named.
    await expect(textbox(page, "profile.headline")).toHaveAttribute("placeholder", "One line about you");
    await expect(textbox(page, "profile.bio")).toHaveAttribute("placeholder", "A few lines about you, in your own words");
    await expect(textbox(page, "profile.location")).toHaveAttribute("aria-placeholder", "e.g. Leeds");
    await expect(textbox(page, "arrangement.tiles.about.text")).toHaveAttribute("placeholder", "A few sentences about you");
    // Typing in a section with no words yet makes its tile whole: the server takes it.
    await typeIn(page, "arrangement.tiles.about.text", "I time queues, then change one thing.");
    await typeIn(page, "arrangement.tiles.education.tools", "Excel, Python");
    await typeIn(page, "profile.headline", "Operations analyst");
    await waitSaved(page);
    const s = await stateNow(page);
    expect(s.arrangement.tiles.about).toEqual({ text: "I time queues, then change one thing." });
    expect(s.arrangement.tiles.education).toEqual({ lines: [], tools: "Excel, Python" });
    await page.reload();
    await waitReady(page);
    expect(await valueAt(page, "arrangement.tiles.about.text")).toBe("I time queues, then change one thing.");
    expect(await valueAt(page, "arrangement.tiles.education.tools")).toBe("Excel, Python");
    expect(await valueAt(page, "profile.headline")).toBe("Operations analyst");
  });

  for (const width of [1440, 412]) {
    test(`Studio's name keeps one word to a line while it is typed, at ${width} wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const f = fresh(fullFixture("x", "studio"), `studio${width}`);
      await openEditor(page, f);
      await settle(page);
      const heading = page.locator(`${READY} ${HOME} h1`);
      const editing = await heading.boundingBox();
      // Every other part of the hero is where the visitor's page has it: the name's box is the same height.
      const hero = page.locator(`${READY} ${HOME} header`).first();
      const heroEditing = await hero.boundingBox();
      // One field, as wide as its heading, with a line to each word.
      const name = textbox(page, "profile.name");
      await expect(name).toHaveValue("Maya Clarke");
      const lines = await name.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
      expect(lines).toBe(2);
      // A third word takes a third line, as the visitor's page would set it.
      await name.click();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type(" Jones");
      expect(await name.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))).toBe(3);
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type("Maya Clarke");
      await waitSaved(page);

      // The visitor's own page, as it is published.
      await page.goto(`/p/${f.username}`);
      await settle(page);
      const visiting = await page.locator(`${HOME} h1`).boundingBox();
      const heroVisiting = await page.locator(`${HOME} header`).first().boundingBox();
      expect(Math.abs(editing!.height - visiting!.height), `the name is ${editing!.height} tall while editing and ${visiting!.height} for a visitor`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(heroEditing!.height - heroVisiting!.height), `the hero is ${heroEditing!.height} tall while editing and ${heroVisiting!.height} for a visitor`).toBeLessThanOrEqual(0.5);
    });
  }
});

test.describe("The crash fallback", () => {
  test("a throw after a change sends the words typed, then opens the step builder with them saved", async ({ page }) => {
    const f = fresh(FULL, "crash");
    await openEditor(page, f, { query: "?crash=change" });
    await textbox(page, "profile.name").click();
    await page.keyboard.press("ControlOrMeta+A");
    // One change, whole: the render after it throws.
    await page.keyboard.insertText("Zadie Example");
    await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
    await expect(page).toHaveURL(/[?&]builder=steps/);
    expect(new URL(page.url()).searchParams.get("crash")).toBeNull();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Zadie Example");
    // Saved on the server, not only shown: the editor has it on the next visit.
    await page.goto("/portfolio");
    await waitReady(page);
    expect(await valueAt(page, "profile.name")).toBe("Zadie Example");
  });

  test("a throw while the editor draws opens the step builder", async ({ page }) => {
    const f = fresh(SPARSE, "crashr");
    await openEditor(page, f, { query: "?crash=render&step=look", wait: false });
    await expect(page.getByRole("heading", { level: 1, name: "Build your portfolio" })).toBeVisible();
    await expect(page).toHaveURL(/[?&]builder=steps/);
    // The step builder keeps its own step from the address.
    await expect(page.locator("nav[aria-label=Steps] a[aria-current=step]")).toHaveText(/Your look/);
    await expect(page.locator("[data-editor]")).toHaveCount(0);
  });

  test("nothing moves when the editor arrives: the loading view is the page it draws", async ({ page }) => {
    const f = fresh(sparseFixture("x", null), "standin");
    // The editor's chunk is held back, as a slow connection holds it.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(/PortfolioEditor/, async (route) => {
      await held;
      await route.continue();
    });
    await openEditor(page, f, { wait: false });
    const loading = page.locator('[data-editor="portfolio"][data-loading]');
    await expect(loading.locator(HOME)).toBeVisible();
    await settle(page);
    const measure = () =>
      page.evaluate((home) => {
        const root = document.querySelector(home)!.getBoundingClientRect();
        return [...document.querySelectorAll(`${home} :is(h1, h2, p, dl, [data-intro], [data-section], [data-avatar], footer)`)].map((el) => {
          const r = el.getBoundingClientRect();
          return [el.tagName, Math.round((r.x - root.x) * 2) / 2, Math.round((r.y - root.y) * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2].join(" ");
        });
      }, HOME);
    const before = await measure();
    const top = await page.locator(HOME).evaluate((el) => el.getBoundingClientRect().y + window.scrollY);
    release();
    await waitReady(page);
    await settle(page);
    expect(await measure()).toEqual(before);
    expect(await page.locator(HOME).evaluate((el) => el.getBoundingClientRect().y + window.scrollY)).toBe(top);
  });
});

test.describe("Coming back to the page", () => {
  // The editor's save does not revalidate the page, so the browser's Back can hand /portfolio the data it
  // was first loaded with. An editor mounted on it would show the old words and save them over the new.
  // (With the gate's check taken out, both tests fail with the old words back in the state.)

  /**
   * Leaves the editor by a link inside the app, as a tile opens its exhbt. The page it goes to is asked
   * for once beforehand, so the development server has built it and the journey itself is not left
   * waiting on a build.
   */
  async function leaveByLink(page: Page) {
    await page.getByRole("link", { name: "Account", exact: true }).first().click();
    await page.waitForURL(/\/account$/);
    await expect(page.locator("[data-editor]")).toHaveCount(0);
  }
  test("after Back, and after the header's link, the editor holds the newest saved words, and a key never saves older words over newer ones", async ({ page }) => {
    const f = fresh(FULL, "back");
    await openEditor(page, f);
    expect((await page.request.get("/account")).status()).toBe(200);
    await typeIn(page, "profile.name", "Robin Okafor");
    await typeIn(page, "arrangement.tiles.about.text", "I count things, then I change one of them.");
    await waitSaved(page);

    // Away by a link inside the app, then the browser's Back.
    await leaveByLink(page);
    await page.goBack();
    await waitReady(page);
    expect(await valueAt(page, "profile.name")).toBe("Robin Okafor");
    await expect(textbox(page, "profile.name")).toHaveValue("Robin Okafor");
    await expect(textbox(page, "arrangement.tiles.about.text")).toHaveValue("I count things, then I change one of them.");

    // A key in another field saves the whole page: the name and About me must still be the new ones after it.
    await typeIn(page, "profile.headline", "Analyst, queues and rotas");
    await waitSaved(page);

    // Away again, and back by the header's own link this time: the newest words, the headline among them.
    await leaveByLink(page);
    await page.getByRole("link", { name: "Your portfolio", exact: true }).first().click();
    await waitReady(page);
    expect(await valueAt(page, "profile.headline")).toBe("Analyst, queues and rotas");
    expect(await valueAt(page, "profile.name")).toBe("Robin Okafor");
    await typeIn(page, "profile.location", "Leeds");
    await waitSaved(page);

    // What the server holds, read afresh: nothing older came back at any step.
    await page.reload();
    await waitReady(page);
    expect(await valueAt(page, "profile.name")).toBe("Robin Okafor");
    expect(await valueAt(page, "profile.headline")).toBe("Analyst, queues and rotas");
    expect(await valueAt(page, "profile.location")).toBe("Leeds");
    expect(await valueAt(page, "arrangement.tiles.about.text")).toBe("I count things, then I change one of them.");
  });

  test("Back while the last change is still on its way waits for it: the words typed before leaving are there, and no key saves over them", async ({ page }) => {
    const f = fresh(FULL, "backfast");
    await openEditor(page, f);
    expect((await page.request.get("/account")).status()).toBe(200);
    await typeIn(page, "profile.location", "Bradford");
    // Not waited for: the editor sends what is waiting as it leaves the page.
    await leaveByLink(page);
    await page.goBack();
    await waitReady(page);
    expect(await valueAt(page, "profile.location")).toBe("Bradford");
    await typeIn(page, "profile.headline", "Operations analyst");
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect(await valueAt(page, "profile.location")).toBe("Bradford");
    expect(await valueAt(page, "profile.headline")).toBe("Operations analyst");
  });
});

test.describe("What the address asks for", () => {
  /** The address as the page has it now, without the origin. */
  const address = (page: Page) => page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);

  test("?open= opens each menu, sheet and popover by name and leaves /portfolio clean; an unknown value is left alone", async ({ page }) => {
    const f = fresh(FULL, "open");
    await openEditor(page, f);
    for (const sheet of ["look", "address", "job-links", "team", "links"] as const) {
      await page.goto(`/portfolio?open=${sheet}`);
      await waitReady(page);
      await expect.poll(async () => (await uiNow(page)).sheet, `?open=${sheet}`).toBe(sheet);
      await expect.poll(() => address(page)).toBe("/portfolio");
    }
    // The two hashes sent emails and other pages carry.
    for (const [hash, sheet] of [["#team-projects", "team"], ["#job-links", "job-links"]] as const) {
      // From another document: a hash alone on the same address would not load the page again.
      await page.goto("about:blank");
      await page.goto(`/portfolio${hash}`);
      await waitReady(page);
      await expect.poll(async () => (await uiNow(page)).sheet, hash).toBe(sheet);
      await expect.poll(() => address(page)).toBe("/portfolio");
    }
    // What the editor does not know stays where it is, and nothing opens.
    await page.goto("/portfolio?open=nothing&utm_source=email");
    await waitReady(page);
    await settle(page);
    expect((await uiNow(page)).sheet).toBeNull();
    expect(await address(page)).toBe("/portfolio?open=nothing&utm_source=email");
  });

  test("the step builder's ?step= addresses: you puts the cursor in the name, look and publish open their sheets", async ({ page }) => {
    const f = fresh(FULL, "step");
    await openEditor(page, f, { query: "?step=you" });
    await expect.poll(() => focusedPath(page)).toBe("profile.name");
    await expect.poll(() => address(page)).toBe("/portfolio");
    await page.goto("/portfolio?step=look");
    await waitReady(page);
    await expect.poll(async () => (await uiNow(page)).sheet).toBe("look");
    await page.goto("/portfolio?step=publish");
    await waitReady(page);
    await expect.poll(async () => (await uiNow(page)).sheet).toBe("address");
    await page.goto("/portfolio?step=projects");
    await waitReady(page);
    await expect.poll(() => address(page)).toBe("/portfolio");
    expect((await uiNow(page)).sheet).toBeNull();
  });

  test("?joined=1 opens Team with its note, and the note's words stay in the address until Team closes; ?full=1 alone is read and taken out", async ({ page }) => {
    const f = fresh(FULL, "team");
    await openEditor(page, f, { query: "?joined=1&full=1#team-projects" });
    await expect.poll(async () => (await uiNow(page)).sheet).toBe("team");
    let ui = await uiNow(page);
    expect(ui.team).toBe("joined");
    expect(ui.full).toBe(true);
    // The server draws the Team sheet from the address: a refresh while it is open must still have them.
    await expect.poll(() => address(page)).toBe("/portfolio?joined=1&full=1");
    await call(page, "close");
    await expect.poll(() => address(page)).toBe("/portfolio");
    ui = await uiNow(page);
    expect(ui.team).toBeNull();
    // Opened again, Team has no note: it was said once.
    await call(page, "open", "team");
    expect((await uiNow(page)).team).toBeNull();

    await page.goto("/portfolio?full=1");
    await waitReady(page);
    await expect.poll(async () => (await uiNow(page)).full).toBe(true);
    await expect.poll(() => address(page)).toBe("/portfolio");
    expect((await uiNow(page)).sheet).toBeNull();
  });

  test("?at= marks the exhbt's tile for two seconds, and for a live exhbt the note at the foot gives its link with Copy link", async ({ page }) => {
    const f = fresh(FULL, "at");
    const seeded = await openEditor(page, f, { query: `?at=${"x"}` });
    // An id the page does not have: nothing is marked for long and nothing is said.
    await expect.poll(() => address(page)).toBe("/portfolio");
    const id = seeded.ids.library!;
    await page.goto(`/portfolio?at=${id}`);
    await waitReady(page);
    const card = page.locator(`${READY} [data-card="${id}"]`);
    await expect(card).toHaveAttribute("data-marked", "");
    // It draws in on the theme's motion tokens.
    await expect(card).toHaveCSS("animation-name", "pe-mark");
    expect((await uiNow(page)).marked).toBe(id);
    await expect.poll(() => address(page)).toBe("/portfolio");
    const note = page.locator(".astryx-toast", { hasText: "Where do students sit in the library? is live at" });
    await expect(note).toContainText(`localhost:${new URL(page.url()).port}/p/${f.username}/library-seats`);
    await expect(note.getByRole("button", { name: "Copy link" })).toBeVisible();
    // The mark goes after two seconds; the note stays until it is closed, since it carries the link.
    await expect(card).not.toHaveAttribute("data-marked", "", { timeout: 4000 });
    expect((await uiNow(page)).marked).toBeNull();
    await expect(note).toBeVisible();
  });
});

test.describe("See as a visitor", () => {
  const notOnline = (page: Page) => page.locator("[data-canvas=visitor] [data-not-online]");

  test("on Free the line says only you can see the page, with See plans", async ({ page }) => {
    const f = fresh(fullFixture("x", null, "free"), "vfree");
    await openEditor(page, f);
    await call(page, "seeAsVisitor", true);
    await expect(page.locator(`[data-canvas=visitor] ${HOME}`)).toBeVisible();
    await expect(page.locator("[data-canvas=edit]")).toHaveCount(0);
    await expect(notOnline(page)).toHaveAttribute("data-not-online", "plan");
    await expect(notOnline(page)).toContainText("Only you can see this page on Free");
    await expect(page.locator("[data-canvas=visitor]").getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/account/billing");
  });

  test("on Premium with no address yet, the line asks for one", async ({ page }) => {
    const email = `pe-vnoaddr-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await setKind(page, "page");
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=/account`);
    await page.goto(`/dev/plan?plan=premium&next=${encodeURIComponent("/portfolio")}`);
    await waitReady(page);
    await call(page, "seeAsVisitor", true);
    await expect(notOnline(page)).toHaveAttribute("data-not-online", "address");
    await expect(notOnline(page)).toContainText("Not online yet: claim your address");
    await page.locator("[data-canvas=visitor]").getByRole("button", { name: "Claim your address" }).click();
    expect((await uiNow(page)).sheet).toBe("address");
  });

  test("with an address and every exhbt hidden, the line says to publish one", async ({ page }) => {
    const base = fullFixture("x", null, "premium");
    const f = fresh({ ...base, exhbts: base.exhbts.map((e) => ({ ...e, hidden: true })) }, "vhidden");
    await openEditor(page, f);
    await call(page, "seeAsVisitor", true);
    await expect(notOnline(page)).toHaveAttribute("data-not-online", "nothing-live");
    await expect(notOnline(page)).toContainText("Not online yet: publish an exhbt");
    await expect(page.locator("[data-canvas=visitor]").getByRole("link", { name: "Add an exhbt" })).toHaveAttribute("href", "/exhbts/new");
    await expect(page.locator(`[data-canvas=visitor] ${HOME} [data-card]`)).toHaveCount(0);
  });

  test("a draft, a hidden exhbt and a look being previewed are not in it, and switching back keeps what was typed", async ({ page }) => {
    const base = fullFixture("x", null, "max");
    const f = fresh({ ...base, exhbts: base.exhbts.map((e) => ({ ...e, draft: e.key === "poster", hidden: e.key === "rota" })) }, "vmix");
    const seeded = await openEditor(page, f);
    await typeIn(page, "profile.name", "Robin Okafor  ");
    await call(page, "previewLook", "studio");
    await expect(page.locator(`[data-canvas=edit] ${HOME}`)).toHaveAttribute("data-look", "studio");
    await call(page, "seeAsVisitor", true);
    const visitor = page.locator(`[data-canvas=visitor] ${HOME}`);
    await expect(visitor).toHaveAttribute("data-look", "exhbt");
    await expect(notOnline(page)).toHaveCount(0);
    // The visitor's page, in public mode: no fields, its links live, the words tidied as a save tidies them.
    await expect(visitor.locator("h1")).toHaveText("Robin Okafor");
    await expect(visitor.locator("textarea, [contenteditable]")).toHaveCount(0);
    await expect(visitor.locator(`[data-card="${seeded.ids.poster}"], [data-card="${seeded.ids.rota}"]`)).toHaveCount(0);
    await expect(visitor.locator(`[data-card="${seeded.ids.library}"]`)).toHaveCount(1);
    await expect(visitor.locator("nav[aria-label=Portfolio]")).not.toHaveAttribute("inert", "");

    await call(page, "seeAsVisitor", false);
    await expect(page.locator("[data-canvas=visitor]")).toHaveCount(0);
    await expect(textbox(page, "profile.name")).toHaveValue("Robin Okafor  ");
    await waitSaved(page);
  });
});

test.describe("Problems at the field", () => {
  test("a headline over its limit is not sent, shows at the field, and Show me goes back to it; a line too long shows at the line", async ({ page }) => {
    const f = fresh(FULL, "issues");
    await openEditor(page, f);
    const thirteen = "One two three four five six seven eight nine ten eleven twelve thirteen";
    await typeIn(page, "profile.headline", thirteen);
    const status = saveState(page);
    await expect(status).toHaveAttribute("data-save", "invalid");
    await expect(status).toContainText("Not saved: Keep the headline to 12 words or fewer.");
    const headline = textbox(page, "profile.headline");
    await expect(headline).toHaveAttribute("aria-invalid", "true");
    // The note shows under the field while it has the cursor.
    const note = field(page, "profile.headline").locator("xpath=ancestor::*[contains(@class,'xe-field')][1]").locator(".xe-issue");
    // (It is always there for a screen reader, and shown or not by its opacity.)
    await expect(note).toHaveCSS("opacity", "1");
    await expect(note).toHaveText("Keep the headline to 12 words or fewer.");
    // Nothing was sent: the server still has the old headline.
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__portfolioEditor!.waiting())).toBe(true);

    // From another field, Show me puts the cursor back in the headline.
    await textbox(page, "profile.location").click();
    await expect(note).toHaveCSS("opacity", "0");
    await status.getByRole("button", { name: "Show me" }).click();
    await expect.poll(() => focusedPath(page)).toBe("profile.headline");

    // One word fewer and it saves.
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Backspace");
    for (let i = 0; i < "thirteen".length; i++) await page.keyboard.press("Backspace");
    await expect(headline).not.toHaveAttribute("aria-invalid", "true");
    await waitSaved(page);
    expect(await valueAt(page, "profile.headline")).toBe(thirteen.replace(/ thirteen$/, ""));

    // A line of education with fifteen words, its year among them: the problem is at that line, on its words half.
    const path = "arrangement.tiles.education.lines.1";
    await typeIn(page, path, "One two three four five six seven eight nine ten eleven twelve thirteen fourteen", { part: "label" });
    await expect(status).toHaveAttribute("data-save", "invalid");
    await expect(status).toContainText("Not saved: Keep each line to 14 words or fewer.");
    expect(Object.keys((await uiNow(page)).issues)).toEqual([path]);
    await expect(textbox(page, path, { part: "label" })).toHaveAttribute("aria-invalid", "true");
    await expect(textbox(page, path, { part: "year" })).not.toHaveAttribute("aria-invalid", "true");
    await textbox(page, "profile.location").click();
    await status.getByRole("button", { name: "Show me" }).click();
    await expect.poll(() => focusedPath(page)).toBe(path);
    await page.keyboard.press("ControlOrMeta+End");
    for (let i = 0; i < " fourteen".length; i++) await page.keyboard.press("Backspace");
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect(await valueAt(page, path)).toBe("One two three four five six seven eight nine ten eleven twelve thirteen, 2022–2023");
  });
});

test.describe("Undo", () => {
  const SIX = ["featured", "work", "about", "experience", "quote", "contact"];

  test("Undo takes back the newest step and names the next, keeps what was typed since, and Ctrl+Z does it outside a field", async ({ page }) => {
    const f = fresh(FULL, "undo");
    await openEditor(page, f);
    const undo = page.locator("#pe-undo");
    await expect(undo).toHaveAccessibleName("Undo");
    await expect(undo).toHaveAttribute("aria-disabled", "true");

    await changeWith(page, { removeSection: "experience" }, "removed Experience");
    await expect(undo).toHaveAccessibleName("Undo: removed Experience");
    await changeWith(page, { moveSection: { from: 2, to: 0 } }, "moved About me");
    await expect(undo).toHaveAccessibleName("Undo: moved About me");
    expect((await stateNow(page)).arrangement.sections).toEqual(["about", "featured", "work", "quote", "contact"]);
    // Typing is never a step, and an Undo never takes it back.
    await typeIn(page, "profile.headline", "Analyst, queues and rotas");
    expect(await undoLabel(page)).toBe("moved About me");

    await undo.click();
    expect((await stateNow(page)).arrangement.sections).toEqual(["featured", "work", "about", "quote", "contact"]);
    await expect(undo).toHaveAccessibleName("Undo: removed Experience");
    await expect(page.locator("[data-said]").last()).toContainText("Undone: moved About me.");

    // Ctrl or Cmd and Z, with the focus outside a text field (on Undo itself).
    await undo.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(async () => (await stateNow(page)).arrangement.sections).toEqual(SIX);
    expect(await undoLabel(page)).toBeNull();
    await expect(undo).toHaveAccessibleName("Undo");
    expect(await valueAt(page, "profile.headline")).toBe("Analyst, queues and rotas");
    await waitSaved(page);
    await page.reload();
    await waitReady(page);
    expect((await stateNow(page)).arrangement.sections).toEqual(SIX);
    expect(await valueAt(page, "profile.headline")).toBe("Analyst, queues and rotas");

    // In a text field, Ctrl+Z is the field's own undo: the editor's steps are left alone.
    await changeWith(page, { removeSection: "quote" }, "removed Quote");
    await textbox(page, "profile.location").click();
    await page.keyboard.press("End");
    await page.keyboard.type("x");
    await page.keyboard.press("ControlOrMeta+z");
    expect(await undoLabel(page)).toBe("removed Quote");
    expect((await stateNow(page)).arrangement.sections).not.toContain("quote");
  });

  test("undo's rules: a line removed, another typed in since, then Undo brings the line back and keeps the typing", () => {
    const state = (lines: string[], headline = "") =>
      ({ profile: { headline }, arrangement: { sections: SIX, tiles: { education: { lines, tools: "" } } } }) as unknown as BuilderState;
    const start = state(["BSc Geography, 2026", "A levels, 2022", "GCSEs, 2020"]);
    const removed = state(["A levels, 2022", "GCSEs, 2020"]);
    const entry = entryFor("removed a line of education", start, removed)!;
    expect(entry.steps).toHaveLength(1);
    // Typed since: the second line now, and the headline.
    const typed = state(["A levels, 2022", "GCSEs: nine, 2020"], "Analyst");
    const back = applyUndo(typed, entry);
    expect(back.arrangement.tiles.education!.lines).toEqual(["BSc Geography, 2026", "A levels, 2022", "GCSEs: nine, 2020"]);
    expect(back.profile.headline).toBe("Analyst");
    // A change that changes nothing is no step.
    expect(entryFor("nothing", start, start)).toBeNull();
  });
});

test.describe("Saving, after a deploy and in two tabs", () => {
  test("the status says Saved · live when visitors can see the page, Saved on Free, and hiding every exhbt drops live", async ({ page }) => {
    const f = fresh(FULL, "live");
    const seeded = await openEditor(page, f);
    const status = saveState(page);
    await expect(status).toHaveText("Saved · live");
    await expect(status).toHaveAttribute("data-live", "");
    await changeWith(page, { hide: Object.values(seeded.ids) }, "hid every exhbt");
    await waitSaved(page);
    await expect(status).toHaveText("Saved");
    await expect(status).not.toHaveAttribute("data-live", "");

    const free = fresh(fullFixture("x", null, "free"), "livefree");
    await openEditor(page, free);
    await expect(saveState(page)).toHaveText("Saved");
  });

  test("after a deploy the words that could not be saved are kept in the browser and offered back once after the reload", async ({ page }) => {
    const f = fresh(FULL, "stale");
    await openEditor(page, f, { query: "?save=stale" });
    await typeIn(page, "profile.headline", "Analyst, kept through a deploy");
    const status = saveState(page);
    await expect(status).toHaveAttribute("data-save", "stale");
    await expect(status).toContainText("The site was updated. Reload to carry on.");
    await expect(status.getByRole("button", { name: "Reload" })).toBeVisible();

    // The reload, without ?save=stale (it would stay in the address).
    await page.goto("/portfolio");
    await waitReady(page);
    expect(await valueAt(page, "profile.headline")).toBe("Operations analyst, food service and retail");
    const offer = page.locator("[data-kept-offer]");
    await expect(offer).toContainText("Your last changes were not saved before the reload");
    await offer.getByRole("button", { name: "Put back the changes from before the reload" }).click();
    await expect(offer).toHaveCount(0);
    expect(await valueAt(page, "profile.headline")).toBe("Analyst, kept through a deploy");
    await expect(textbox(page, "profile.headline")).toHaveValue("Analyst, kept through a deploy");
    expect(await undoLabel(page)).toBe("put back the changes from before the reload");
    await waitSaved(page);

    // Offered once: the next visit has it saved, and no offer.
    await page.goto("/portfolio");
    await waitReady(page);
    expect(await valueAt(page, "profile.headline")).toBe("Analyst, kept through a deploy");
    await settle(page);
    await expect(page.locator("[data-kept-offer]")).toHaveCount(0);
  });

  test("open in two tabs, each says so; the note goes when one closes; the last save wins", async ({ page, context }) => {
    const f = fresh(FULL, "tabs");
    await openEditor(page, f);
    const other = await context.newPage();
    await other.goto("/portfolio");
    await waitReady(other);
    for (const p of [page, other]) {
      await expect(p.locator("[data-other-tab]")).toContainText("This page is open in another tab");
      // Heard as well as seen.
      await expect(p.locator("[data-said]").last()).toContainText("This page is open in another tab.");
    }

    await typeIn(page, "profile.location", "Leeds");
    await waitSaved(page);
    await typeIn(other, "profile.location", "York");
    await waitSaved(other);
    await other.close();
    await expect(page.locator("[data-other-tab]")).toHaveCount(0);
    await page.reload();
    await waitReady(page);
    expect(await valueAt(page, "profile.location")).toBe("York");
  });
});

test.describe("Box for box with the visitor's page", () => {
  // The six looks E did not measure (Exhbt and Studio were, in milestone 1), on the full fixture, and
  // Ledger and Notebook with no education line, where the location and the year are block fields. Every
  // landmark of the page (HOME_BOXES) is where /p/<name> has it, within half a pixel, at 1440 and 412.
  // Nothing on the full fixture is empty, so of HOME_EDIT_ONLY_IN_FLOW only "what you're looking for, as
  // stored" can differ, and it is inside the boxes measured here, never one of them.
  const cases: { look: string; noEducation?: boolean }[] = [
    { look: "classic" },
    { look: "notebook" },
    { look: "mono" },
    { look: "night" },
    { look: "ledger" },
    { look: "bloom" },
    { look: "ledger", noEducation: true },
    { look: "notebook", noEducation: true },
  ];
  for (const c of cases) {
    test(`${c.look}${c.noEducation ? ", with no education line," : ""} is the visitor's page box for box at 1440 and 412`, async ({ page }) => {
      test.slow();
      const base = fullFixture("x", c.look);
      const layout = base.layout as { tiles: Record<string, unknown> };
      const fixture = c.noEducation ? { ...base, layout: { ...layout, tiles: { ...layout.tiles, education: { lines: [], tools: "Excel, Python, SQL, Tableau" } } } } : base;
      const f = fresh(fixture, `box${c.look}${c.noEducation ? "n" : ""}`);
      await openEditor(page, f);
      for (const width of [1440, 412]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/portfolio");
        await waitReady(page);
        await settle(page);
        const editing = await boxes(page);
        await page.goto(`/p/${f.username}`);
        await settle(page);
        const visiting = await boxes(page);
        expect(visiting.length, "the visitor's page drew its landmarks").toBeGreaterThan(10);
        expect(differences(visiting, editing), `${c.look} at ${width}`).toEqual([]);
      }
    });
  }
});

test.describe("Accessibility", () => {
  test("the editing page, See as a visitor and a problem at a field have no WCAG 2.1 AA violations axe can find", async ({ page }) => {
    const f = fresh(FULL, "axe");
    await openEditor(page, f);
    await settle(page);
    const check = async (where: string) => {
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), where).toEqual([]);
    };
    await check("the editing page");
    await typeIn(page, "profile.headline", "One two three four five six seven eight nine ten eleven twelve thirteen");
    await expect(saveState(page)).toHaveAttribute("data-save", "invalid");
    await check("a problem at the headline");
    await call(page, "seeAsVisitor", true);
    await settle(page);
    await check("See as a visitor");
  });
});

test.describe("What draws again", () => {
  /**
   * Counts the charts' renders without touching components/charts/Chart.tsx: a stand-in for React's
   * devtools hook, put in before the page's scripts, sees every commit. A Chart fiber rendered in a commit
   * is one React did work on (PerformedWork, flag 1) that is not the very fiber the last commit of that
   * root had: a subtree React skipped keeps its old fibers, flags and all. Kept per root, since Next's
   * development overlay commits a root of its own.
   */
  const COUNT_CHARTS = () => {
    const seenBy = new WeakMap<object, WeakSet<object>>();
    const w = window as unknown as { __chartRenders: number; __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown };
    w.__chartRenders = 0;
    type Fiber = { type?: { name?: string } | null; flags: number; child: Fiber | null; sibling: Fiber | null };
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      checkDCE: () => {},
      onScheduleFiberRoot: () => {},
      onCommitFiberUnmount: () => {},
      onPostCommitFiberRoot: () => {},
      onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
        const seen = seenBy.get(root) ?? new WeakSet<object>();
        const now = new WeakSet<object>();
        const stack: Fiber[] = [root.current];
        while (stack.length) {
          const f = stack.pop()!;
          if (f.type && typeof f.type === "function" && (f.type as { name?: string }).name === "Chart") {
            now.add(f);
            if (!seen.has(f) && (f.flags & 1) === 1) w.__chartRenders++;
          }
          if (f.child) stack.push(f.child);
          if (f.sibling) stack.push(f.sibling);
        }
        seenBy.set(root, now);
      },
    };
  };
  const reset = (page: Page) =>
    page.evaluate(() => {
      window.__portfolioRenders = {};
      (window as unknown as { __chartRenders: number }).__chartRenders = 0;
    });
  const read = async (page: Page) => {
    await settle(page);
    return { ...(await renders(page)), charts: await page.evaluate(() => (window as unknown as { __chartRenders: number }).__chartRenders) };
  };

  test("a key in the headline, a key in the intro and a section move: what renders, charts included", async ({ page }) => {
    await page.addInitScript(COUNT_CHARTS);
    const f = fresh(FULL, "renders");
    await openEditor(page, f);
    await settle(page);
    // The counter sees the page's charts as they mount: it is working.
    expect(await page.evaluate(() => (window as unknown as { __chartRenders: number }).__chartRenders)).toBeGreaterThan(0);

    // Nothing typed: what draws on its own after the page is up (a chart measuring itself, say).
    await textbox(page, "profile.headline").click();
    await page.keyboard.press("End");
    await reset(page);
    await page.waitForTimeout(1000);
    const idle = await read(page);
    await reset(page);
    await page.keyboard.type("s");
    const headline = await read(page);
    await reset(page);
    await page.keyboard.type("s");
    const headline2 = await read(page);

    await textbox(page, "profile.bio").click();
    await page.keyboard.press("End");
    await reset(page);
    await page.keyboard.type("s");
    const intro = await read(page);

    await reset(page);
    await changeWith(page, { moveSection: { from: 2, to: 3 } }, "moved About me");
    const move = await read(page);

    const figures = { "nothing typed": idle, "a key in the headline": headline, "a second key in the headline": headline2, "a key in the intro": intro, "a section move": move };
    console.log(`Render counts: ${JSON.stringify(figures)}`);
    test.info().annotations.push({ type: "render counts", description: JSON.stringify(figures) });
    // A key draws the page and the hero again, and no section, tile or chart.
    for (const [what, n] of Object.entries({ headline, intro })) {
      expect(Object.keys(n).filter((k) => /^(section|tile):/.test(k) && n[k as keyof typeof n]), what).toEqual([]);
      expect(n.charts, what).toBe(0);
    }
    // A move draws no chart again.
    expect(move.charts).toBe(0);
  });
});
