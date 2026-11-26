import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LAYOUT_REFUSED } from "../lib/add-exhbt";
import { ENTITLEMENTS, PLAN_NAMES } from "../lib/entitlements";
import { emptyDoc, LIMITS, type ExhbtDoc } from "../lib/exhbt/blocks";
import { CLASSIC_FORMATS, FORMAT_RULES, LAYOUT_NOT_OFFERED, OFFERED_FORMATS, withFormat } from "../lib/exhbt/formats";
import { whereAPublishedExhbtGoes } from "../lib/exhbt/publish-words";
import { WHAT_AN_EXHBT_IS } from "../lib/exhbt/what-it-is";
import { portfolioHost } from "../lib/hosts";
import { ADD, ADD_EXHBT, BUILD_IT_YOURSELF, DRAFT_WITH_AI } from "./add-exhbt";
import { DRAFT_PROJECT, keepClassic, layoutButton, layoutGroup, openLayoutMenu, SEL, signInAs, waitEditor } from "./editor";
import { buildRoadmap, uniqueEmail, unlockProjects, waitForResult } from "./helpers";
import { freshName, READY } from "./page-editor";

/*
 * "Add an exhbt" (/exhbts/new): the chooser with its two ways to start, the layouts of "Write it myself",
 * and the addresses that skip the chooser. Rory, 26 Nov 2026: "Maybe we need for the exhbts a build from
 * scratch and a build with AI option?" Both existed, but not as a choice anyone saw.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Each test opens several pages, some of them the editor, which a development server is slow to serve the first time.
test.describe.configure({ timeout: 240_000 });

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

/** The person's exhbts as the account export gives them (the development store's own records). */
async function stored(page: Page): Promise<{ id: string; doc: ExhbtDoc }[]> {
  return ((await (await page.request.get("/api/account/export")).json()) as { exhbts: { id: string; doc: ExhbtDoc }[] }).exhbts;
}

const idIn = (url: string) => url.match(/\/exhbts\/([0-9a-f-]{36})\/edit/)![1]!;
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const exactly = (address: string) => new RegExp(`${address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

// A development server builds each route on its first request, which is slow on a busy machine. Build this
// spec's routes before any test's clock starts (signed out, each answers by sending the visitor to sign in).
test.beforeAll(async ({ request }) => {
  test.setTimeout(600_000);
  for (const path of ["/exhbts", ADD_EXHBT, "/exhbts/00000000-0000-4000-8000-000000000000/edit", "/login"]) {
    await request.get(path, { timeout: 300_000, maxRedirects: 0 }).catch(() => {});
  }
});

test.describe("The chooser", () => {
  test("says what an exhbt is, offers two ways of equal weight, and both lead where they say", async ({ page }) => {
    const username = freshName("addboth");
    await signInAs(page, username, "premium");

    // The list has one way to start an exhbt, and it opens the chooser.
    await page.getByRole("link", { name: ADD.listLink }).click();
    await page.waitForURL(exactly(ADD_EXHBT));
    await expect(page.getByRole("heading", ADD.chooserHeading)).toBeVisible();
    await expect(page).toHaveTitle(/^Add an exhbt/);

    // What it is: the product's own sentence, the one /what-is-an-exhbt opens with.
    await expect(page.getByText(WHAT_AN_EXHBT_IS)).toBeVisible();

    // Two ways, each one card with one control, a link, and neither is the page's primary button.
    const draft = page.locator(ADD.draftWay);
    const blank = page.locator(ADD.blankWay);
    await expect(draft.getByRole("heading", { level: 2, name: "Draft it from my files" })).toBeVisible();
    await expect(blank.getByRole("heading", { level: 2, name: "Write it myself" })).toBeVisible();
    for (const way of [draft, blank]) await expect(way.locator("a, button, input, [tabindex]")).toHaveCount(1);
    await expect(draft.getByRole("link", { name: ADD.draftLink })).toHaveAttribute("href", DRAFT_WITH_AI);
    await expect(blank.getByRole("link", { name: ADD.layoutsLink })).toHaveAttribute("href", BUILD_IT_YOURSELF);
    const grounds = await page.locator(`${ADD.draftWay} a, ${ADD.blankWay} a`).evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    expect(grounds).toHaveLength(2);
    expect(grounds[0]).toBe(grounds[1]);
    // Equal weight on a wide screen: the same width, the same height, side by side.
    const [a, b] = [await draft.boundingBox(), await blank.boundingBox()];
    expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
    expect(Math.abs(a!.height - b!.height)).toBeLessThan(1);
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);

    // Each says what it needs, who writes what, the allowance, and what happens straight after.
    await expect(draft).toContainText("The AI writes a first version from them and nothing else; you check every word.");
    await expect(draft).toContainText(`${ENTITLEMENTS.premium.draftsPer30Days} of ${ENTITLEMENTS.premium.draftsPer30Days} AI drafts left`);
    await expect(draft).toContainText("You'll add your files, then get the first version to edit.");
    await expect(blank).toContainText("Nothing to upload first.");
    await expect(blank).toContainText("You'll choose a layout, then land on the empty page.");
    // The second way shows the layouts on offer: one sketch for each, with shapes in it.
    await expect(blank.locator("[data-offered] svg")).toHaveCount(OFFERED_FORMATS.length);

    // Where it ends up: the publish step's own sentence, with this person's portfolio address.
    const where = page.getByTestId("where-it-goes");
    await expect(where).toContainText("Publishing puts this exhbt on your portfolio at");
    await expect(where).toContainText("with its own link to send with applications.");
    await expect(where.getByRole("link")).toHaveAttribute("href", `/p/${username}`);

    await axe(page);

    // Draft it from my files: the upload form, as it always was.
    await draft.getByRole("link", { name: ADD.draftLink }).click();
    await page.waitForURL(exactly(DRAFT_WITH_AI));
    await expect(page.getByRole("heading", SEL.draftHeading)).toBeVisible();
    await expect(page.locator(SEL.draftForm)).toBeAttached();
    await expect(page.getByRole("button", { name: "Draft my exhbt" })).toBeVisible();

    // Write it myself: the layouts, and one of them makes an empty exhbt and opens the editor.
    await page.goBack();
    await blank.getByRole("link", { name: ADD.layoutsLink }).click();
    await page.waitForURL(exactly(BUILD_IT_YOURSELF));
    await expect(page.getByRole("heading", ADD.layoutsHeading)).toBeVisible();
    await expect(page).toHaveTitle(/^Choose a layout/);
    await page.getByRole("button", { name: ADD.layoutButton("case-study") }).click();
    await page.waitForURL(ADD.editUrl);
    await waitEditor(page);
    // A case study is stored exactly as "Start from scratch" always stored it: an empty doc with no layout key.
    const made = (await stored(page)).find((e) => e.id === idIn(page.url()))!;
    expect(made.doc).toEqual(emptyDoc());
  });

  test("works from the keyboard, and with the page's scripts off a card is pressed anywhere on it", async ({ page, browser }) => {
    const username = freshName("addkeys");
    await signInAs(page, username, "premium");
    await page.goto(ADD_EXHBT);

    // The two ways are the next two stops after the page's header, in order.
    await page.locator(ADD.draftWay).getByRole("link").focus();
    await expect(page.locator(ADD.draftWay).getByRole("link", { name: ADD.draftLink })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator(ADD.blankWay).getByRole("link", { name: ADD.layoutsLink })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(exactly(BUILD_IT_YOURSELF));
    await expect(page.getByRole("heading", ADD.layoutsHeading)).toBeVisible();
    // Each layout is one stop too, a submit button, and Enter on it makes the exhbt.
    await page.getByRole("button", { name: ADD.layoutButton("gallery") }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(ADD.editUrl);
    expect((await stored(page)).find((e) => e.id === idIn(page.url()))!.doc.format).toBe("gallery");

    // Scripts off: the same session in a browser that runs none. A pointer press on a card's picture,
    // not on its button, follows the link or sends the form.
    const off = await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() });
    const plain = await off.newPage();
    const pressPicture = async (card: string) => {
      const box = (await plain.locator(card).boundingBox())!;
      await plain.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25);
    };
    await plain.goto(ADD_EXHBT);
    await pressPicture(ADD.draftWay);
    await plain.waitForURL(exactly(DRAFT_WITH_AI));
    await expect(plain.getByRole("heading", SEL.draftHeading)).toBeVisible();
    await plain.goto(ADD_EXHBT);
    await pressPicture(ADD.blankWay);
    await plain.waitForURL(exactly(BUILD_IT_YOURSELF));
    await expect(plain.getByRole("heading", ADD.layoutsHeading)).toBeVisible();
    await pressPicture(ADD.layoutCard("research"));
    await plain.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    expect((await stored(page)).find((e) => e.id === idIn(plain.url()))!.doc.format).toBe("research");
    await off.close();
  });

  test("nothing scrolls sideways at 390px, and the layouts become a list of rows", async ({ page }) => {
    await signInAs(page, freshName("addphone"), "max");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ADD_EXHBT);
    await expect(page.getByRole("heading", ADD.chooserHeading)).toBeVisible();
    expect(await sideways(page)).toBe(0);
    // The two ways stack, the first above the second.
    const [a, b] = [await page.locator(ADD.draftWay).boundingBox(), await page.locator(ADD.blankWay).boundingBox()];
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
    // The page is no longer than its footer: the example picture's hidden parts add nothing below it.
    expect(await page.evaluate(() => document.documentElement.scrollHeight - Math.round(document.querySelector("footer")!.getBoundingClientRect().bottom + scrollY))).toBeLessThanOrEqual(1);
    await axe(page);

    await page.goto(BUILD_IT_YOURSELF);
    await expect(page.getByRole("heading", ADD.layoutsHeading)).toBeVisible();
    expect(await sideways(page)).toBe(0);
    // Each layout is a short row, its sketch beside its name, and they sit one under another.
    const boxes = await page.locator("[data-layout]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: r.y, h: r.height, w: r.width })));
    expect(boxes).toHaveLength(OFFERED_FORMATS.length);
    for (const [i, box] of boxes.entries()) {
      expect(box.h).toBeLessThan(160);
      if (i > 0) expect(box.y).toBeGreaterThan(boxes[i - 1]!.y + boxes[i - 1]!.h - 1);
    }
    await axe(page);
  });
});

test.describe("Write it myself", () => {
  test("each layout on offer makes an empty exhbt in that layout and opens the new editor", async ({ page }) => {
    test.setTimeout(300_000); // seven exhbts, each opened in the editor
    await signInAs(page, freshName("addeach"), "max");
    await page.goto(BUILD_IT_YOURSELF);

    // The layouts the new editor offers, in its order, each named, with the editor's sketch and line.
    const cards = page.locator("[data-layout]");
    await expect(cards).toHaveCount(OFFERED_FORMATS.length);
    expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-layout")))).toEqual([...OFFERED_FORMATS]);
    for (const f of OFFERED_FORMATS) {
      const card = page.locator(ADD.layoutCard(f));
      // Drawn at the third heading size, and a second-level heading in the page's outline.
      await expect(card.locator('h3[aria-level="2"]')).toHaveText(FORMAT_RULES[f].name);
      expect(await card.locator(".add-layout-art svg > *").count()).toBeGreaterThan(2);
      await expect(card.getByRole("button")).toHaveCount(1);
    }
    const lines = await page.locator("[data-layout] [data-suits]").allTextContents();
    expect(lines.every((l) => l.trim().length > 0)).toBe(true);
    await axe(page);

    for (const f of OFFERED_FORMATS) {
      await page.goto(BUILD_IT_YOURSELF);
      await page.getByRole("button", { name: ADD.layoutButton(f) }).click();
      await page.waitForURL(ADD.editUrl);
      const id = idIn(page.url());
      // Stored as an empty doc in that layout and nothing else.
      expect((await stored(page)).find((e) => e.id === id)!.doc, f).toEqual(withFormat(emptyDoc(), f));
      // The new editor opens on it, in that layout, with nothing typed.
      await waitEditor(page);
      await expect(page.locator(`${READY} article[data-exhbt-page]`)).toHaveAttribute("data-format", f);
      await expect(layoutButton(page)).toHaveAccessibleName(`Layout: ${FORMAT_RULES[f].name}`);
      await expect(page.locator(SEL.titleField)).toHaveValue("");
    }

    // The line under each layout is the one the editor's own menu draws for it: written once.
    await openLayoutMenu(page);
    expect(await layoutGroup(page).locator(".xe-layout-line").allTextContents()).toEqual(lines);
    expect(await stored(page)).toHaveLength(OFFERED_FORMATS.length);
  });

  test("the classic editor's three are offered to a person whose editor it is, and the server refuses any other", async ({ page }) => {
    await keepClassic(page);
    await signInAs(page, freshName("addclassic"), "max");
    await page.goto(ADD_EXHBT);
    await expect(page.locator(`${ADD.blankWay} [data-offered] svg`)).toHaveCount(CLASSIC_FORMATS.length);
    await page.goto(BUILD_IT_YOURSELF);
    expect(await page.locator("[data-layout]").evaluateAll((els) => els.map((e) => e.getAttribute("data-layout")))).toEqual([...CLASSIC_FORMATS]);

    // A form built by hand: a layout only the new editor offers, then a name that is no layout at all.
    for (const value of ["essay", "poster"]) {
      await page.goto(BUILD_IT_YOURSELF);
      await page.getByRole("button", { name: ADD.layoutButton("gallery") }).evaluate((b, v) => b.setAttribute("value", v), value);
      await page.getByRole("button", { name: ADD.layoutButton("gallery") }).click();
      await page.waitForURL(exactly(LAYOUT_REFUSED));
      await expect(page.getByText(LAYOUT_NOT_OFFERED)).toBeVisible();
      await expect(page.getByRole("heading", ADD.layoutsHeading)).toBeVisible();
    }
    await axe(page);
    expect(await stored(page)).toHaveLength(0);

    // One of the three is made as asked, and opens in the classic editor.
    await page.getByRole("button", { name: ADD.layoutButton("research") }).click();
    await page.waitForURL(ADD.editUrl);
    const made = (await stored(page)).find((e) => e.id === idIn(page.url()))!;
    expect(made.doc).toEqual(withFormat(emptyDoc(), "research"));
    await expect(page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio", { name: /^Research/ })).toBeChecked();
  });
});

test.describe("Addresses that skip the chooser", () => {
  test("signed out, each address asks you to sign in and comes back to itself", async ({ page }) => {
    for (const address of [ADD_EXHBT, DRAFT_WITH_AI, BUILD_IT_YOURSELF, `${ADD_EXHBT}?into=abc`]) {
      await page.goto(address);
      await page.waitForURL(/\/login\?next=/);
      expect(new URL(page.url()).searchParams.get("next")).toBe(address);
    }
  });

  test("an address that says what is being drafted opens the upload form: ?start=draft and ?into=", async ({ page }) => {
    const own = freshName("addteam");
    const mate = uniqueEmail("addmate");

    // The owner's sample exhbt, and a teammate invited to it.
    expect((await page.request.get(`/dev/portfolio?username=${own}&plan=premium&count=1`, { maxRedirects: 0 })).status()).toBe(307);
    await page.goto(`/auth/dev?email=${own}@example.com&next=/exhbts`);
    const editHref = await page.getByRole("link", { name: /^Edit / }).first().getAttribute("href");
    const title = (await page.getByRole("link", { name: /^Edit / }).first().getAttribute("aria-label"))!.replace(/^Edit /, "");
    const original = idIn(editHref!);
    await page.goto(`/exhbts/${original}/team`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("Their email address").fill(mate);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.locator("#invite-result")).toHaveText(`Invite sent to ${mate}.`);
    await page.goto("/dev/emails");
    await page.getByRole("link", { name: new RegExp(`to ${mate.replace(/[+.]/g, "\\$&")}`) }).first().click();
    const accept = new URL((await page.frameLocator("iframe").getByRole("link", { name: "Accept the invite" }).getAttribute("href"))!);

    // The teammate joins on Free and makes their own exhbt from the project: their plan is now full.
    await page.goto(`/auth/dev?email=${encodeURIComponent(mate)}&next=${encodeURIComponent(accept.pathname + accept.search)}`);
    await expect(page.locator("form[data-ready=true]")).toBeAttached();
    await page.getByLabel("Your name, as it shows on the project").fill("Dev Patel");
    await page.getByRole("button", { name: "Join the team" }).click();
    await page.waitForURL(/\/exhbts\?joined=1/);
    await page.getByRole("button", { name: `Make my own exhbt from ${title}` }).click();
    await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit/);
    const mine = idIn(page.url());

    // ?into= their own exhbt: the upload form, with no chooser on the way, though the plan has no room for another.
    await page.goto(`${ADD_EXHBT}?into=${mine}`);
    await expect(page).toHaveURL(exactly(`${ADD_EXHBT}?into=${mine}`));
    await expect(page.getByRole("heading", SEL.draftHeading)).toBeVisible();
    await expect(page.getByText("Your team's project files are below.")).toBeVisible();
    await expect(page.locator(SEL.draftForm)).toBeAttached();
    await expect(page.getByRole("heading", ADD.chooserHeading)).toHaveCount(0);

    // An exhbt that can't be drafted into: someone else's goes to a fresh upload form, never the chooser.
    await page.goto(`${ADD_EXHBT}?into=${original}`);
    await page.waitForURL(exactly(DRAFT_WITH_AI));
    await expect(page.getByRole("heading", SEL.draftHeading)).toBeVisible();

    // ?start=draft is the form too, and the bare address is the chooser, which says the plan is full.
    await page.goto(ADD_EXHBT);
    await expect(page.getByRole("heading", ADD.chooserHeading)).toBeVisible();
    await expect(page.getByTestId("upgrade-prompt")).toContainText(`Your plan holds ${ENTITLEMENTS.free.exhbts} exhbt`);
  });

  test("a roadmap idea's Build this as an exhbt opens the editor prefilled, with no chooser on the way", async ({ page }) => {
    const email = uniqueEmail("addidea");
    await buildRoadmap(page);
    // The roadmap's own pages are built on their first request here, so this waits longer than waitForResult would alone.
    await page.waitForURL(/\/roadmap\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { level: 1, name: /Your roadmap to/ })).toBeVisible({ timeout: 120_000 });
    await waitForResult(page);
    const roadmap = new URL(page.url()).pathname;
    await unlockProjects(page, { email });
    await expect(page.getByRole("heading", { level: 1, name: "Projects that would prove them" })).toBeVisible();
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`${roadmap}?view=projects`)}`);

    const seen: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) seen.push(new URL(frame.url()).pathname);
    });
    const first = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Build this as an exhbt/ }) }).first();
    const title = (await first.getByRole("heading", { level: 2 }).innerText()).trim();
    await first.getByRole("button", { name: /^Build this as an exhbt/ }).click();
    await page.waitForURL(ADD.editUrl);
    await waitEditor(page);
    await expect(page.locator(SEL.titleField)).toHaveValue(title.slice(0, LIMITS.titleChars));
    expect(seen).not.toContain(ADD_EXHBT);
  });
});

test.describe("The plan's rules", () => {
  test("with no room for another exhbt, the page shows the upgrade offer the list shows, and offers no way to start", async ({ page }) => {
    const username = freshName("addfull");
    expect((await page.request.get(`/dev/portfolio?username=${username}&plan=free&count=1`, { maxRedirects: 0 })).status()).toBe(307);
    await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
    const reason = `Your plan holds ${ENTITLEMENTS.free.exhbts} exhbt. Delete one, or move to ${PLAN_NAMES.premium} for ${ENTITLEMENTS.premium.exhbts}.`;

    // The list: the upgrade offer stands where "Add an exhbt" would be.
    await expect(page.getByRole("heading", SEL.listHeading)).toBeVisible();
    await expect(page.getByRole("link", { name: ADD.listLink })).toHaveCount(0);
    await expect(page.getByTestId("upgrade-prompt")).toContainText(reason);

    // The chooser and the layouts: the same offer, and nothing to press but it.
    for (const address of [ADD_EXHBT, BUILD_IT_YOURSELF]) {
      await page.goto(address);
      await expect(page.getByRole("heading", ADD.chooserHeading)).toBeVisible();
      const prompt = page.getByTestId("upgrade-prompt");
      await expect(prompt).toContainText(reason);
      await expect(prompt.getByRole("link", { name: new RegExp(`^Upgrade to ${PLAN_NAMES.premium}`) })).toHaveAttribute("href", "/account/billing");
      await expect(page.locator("[data-way], [data-layout]")).toHaveCount(0);
    }
    await axe(page);
    // The upload form refuses as it always did.
    await page.goto(DRAFT_WITH_AI);
    await expect(page.getByRole("alert").filter({ hasText: reason })).toBeVisible();
    await expect(page.getByRole("button", { name: "Draft my exhbt" })).toHaveCount(0);
  });

  test("with no AI drafts left, the first way says so with the form's reason, and Write it myself still works", async ({ page }) => {
    await signInAs(page, freshName("addspent"), "free");
    // Free's AI drafts for the last 30 days, used up; then the drafted exhbts deleted, so the plan has room again.
    for (let i = 0; i < ENTITLEMENTS.free.draftsPer30Days; i++) {
      expect((await page.request.post("/api/exhbts/draft", { data: { text: DRAFT_PROJECT } })).status()).toBe(200);
      await page.goto("/exhbts");
      await page.getByRole("button", { name: /^Delete / }).first().click();
      await page.getByRole("button", { name: "Yes, delete" }).click();
      await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(0);
    }
    const n = ENTITLEMENTS.free.draftsPer30Days;
    const reason = `You've used your ${n} AI ${n === 1 ? "draft" : "drafts"} for the last 30 days. ${PLAN_NAMES.premium} includes ${ENTITLEMENTS.premium.draftsPer30Days}, or wait until one frees up.`;

    await page.goto(ADD_EXHBT);
    const draft = page.locator(ADD.draftWay);
    await expect(draft.getByRole("heading", { level: 2, name: "Draft it from my files" })).toBeVisible();
    // No way into the upload form from here, and the reason the form itself gives.
    await expect(draft.getByRole("link", { name: ADD.draftLink })).toHaveCount(0);
    await expect(draft.locator(`a[href="${DRAFT_WITH_AI}"]`)).toHaveCount(0);
    await expect(draft.getByTestId("upgrade-prompt")).toContainText(reason);
    await expect(draft.getByRole("link", { name: new RegExp(`^Upgrade to ${PLAN_NAMES.premium}`) })).toHaveAttribute("href", "/account/billing");
    // Pressing the card does nothing: only its upgrade links are controls.
    const box = (await draft.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25);
    await expect(page).toHaveURL(exactly(ADD_EXHBT));
    // On Free nothing is promised now: the page says where an exhbt goes once published, then the plan rule's own reason.
    await expect(page.getByTestId("where-it-goes")).toHaveCount(0);
    await expect(page.locator('[data-where="later"]')).toHaveText(
      `${whereAPublishedExhbtGoes(portfolioHost("yourname"))} Publishing to your own link comes with ${PLAN_NAMES.premium}.`,
    );
    await axe(page);
    await page.goto(DRAFT_WITH_AI);
    await expect(page.getByRole("alert").filter({ hasText: reason })).toBeVisible();

    // Write it myself is untouched: the layouts no longer offer the AI, and one of them makes the exhbt.
    await page.goto(ADD_EXHBT);
    await page.locator(ADD.blankWay).getByRole("link", { name: ADD.layoutsLink }).click();
    await expect(page.getByRole("heading", ADD.layoutsHeading)).toBeVisible();
    await expect(page.locator(`a[href="${DRAFT_WITH_AI}"]`)).toHaveCount(0);
    await page.getByRole("button", { name: ADD.layoutButton("case-study") }).click();
    await page.waitForURL(ADD.editUrl);
    await waitEditor(page);
    expect(await stored(page)).toHaveLength(1);
  });
});
