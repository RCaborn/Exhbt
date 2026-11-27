import { expect, test, type APIRequestContext, type Page } from "./editor-test";
import { SCHEMA_VERSION, text, type ExhbtDoc } from "../lib/exhbt/blocks";
import { flushPending, notePending, registerSender } from "../components/exhbt-editor/pending";
import { keepClassic, SEL } from "./editor-classic-helpers";

// The way back to the classic editor (decision 0026, "The classic editor: the switch, the fallback, the escape";
// docs/briefs/edit-on-page/README.md, "The kill switch, and how it is tested"): the switch (EXHBT_EDITOR, which
// /dev/editor overrides with a cookie for one browser in development), the escape for one visit (?editor=classic),
// the crash fallback round the new editor (?crash=render, and a chunk that fails to load) and the route's error page
// (?crash=server). Each test seeds its exhbt with POST /dev/parity for a fresh username, then signs in with
// /auth/dev; signInAs would clear the seeded exhbt.

const CLASSIC = '[data-editor="classic"]';
/** The classic editor, hydrated. */
const CLASSIC_READY = `${CLASSIC} [data-ready=true]`;
/** The new editor, up: the loading view (drawn on the server) has no data-ready. */
const NEW_READY = '[data-editor="page"][data-ready="true"]';
const NOTICE = "Something went wrong with the new editor. Your work is saved.";
const LINE = "You're in the classic editor.";

const doc = (): ExhbtDoc => ({
  schemaVersion: SCHEMA_VERSION,
  title: "Shorter queues",
  context: "Year 2 module",
  skills: ["Excel"],
  gap: text("Would a second till help?"),
  flow: [{ step: "Timed it" }, { step: "Added a till" }, { step: "Timed it again" }],
  sections: [{ id: "findings", kind: "findings", items: [text("Waits fell from 11 to 4 minutes."), text("Sales held steady.")] }],
});

async function signIn(page: Page, username: string) {
  await page.goto(`/auth/dev?email=${username}@example.com&next=/exhbts`);
  await expect(page.getByRole("heading", SEL.listHeading)).toBeVisible();
}

/** Stores an exhbt for a fresh user, signs in as them and returns the user and the exhbt's edit address. */
async function seed(page: Page, tag: string): Promise<{ username: string; edit: string }> {
  const username = `${tag}${Math.random().toString(36).slice(2, 7)}`;
  const res = await page.request.post("/dev/parity", { data: { username, slug: "queues", doc: doc() } });
  expect(res.status()).toBe(200);
  const { id } = (await res.json()) as { id: string };
  await signIn(page, username);
  return { username, edit: `/exhbts/${id}/edit` };
}

/** Opens the address and says which editor it served, once that editor is up. */
async function served(page: Page, url: string): Promise<string | null> {
  await page.goto(url);
  const up = page.locator(`${CLASSIC_READY}, ${NEW_READY}`);
  await expect(up).toHaveCount(1);
  return up.evaluate((el) => el.closest("[data-editor]")?.getAttribute("data-editor") ?? null);
}

/** What /api/health says is in force. It answers 503 here (no database), so read the body and ignore the status. */
const healthSays = async (request: APIRequestContext) => ((await (await request.get("/api/health?only=editor")).json()) as { editor: string }).editor;

/**
 * Records the crash notice as the page draws it. The stub's flushPending resolves at once, so the notice is on
 * screen only until the reload; and once the reload has started, Playwright cannot read the page it is leaving
 * (holding the classic page's request back only stalls the locator). So a watcher in the page reports the notice,
 * with its words, the moment it is drawn and visible.
 */
async function watchNotice(page: Page): Promise<string[]> {
  const shown: string[] = [];
  await page.exposeFunction("noticeShown", (words: string) => void shown.push(words));
  await page.addInitScript((notice) => {
    new MutationObserver((_, watcher) => {
      const el = [...document.querySelectorAll<HTMLElement>("[role=alert]")].find((e) => e.textContent?.includes(notice));
      if (el?.checkVisibility()) {
        watcher.disconnect();
        void (window as unknown as { noticeShown: (words: string) => Promise<void> }).noticeShown(el.textContent ?? "");
      }
    }).observe(document, { childList: true, subtree: true });
  }, NOTICE);
  return shown;
}

test.describe("the edit page's switch", () => {
  test("serves the new editor, the classic one after /dev/editor?kind=classic, and the new one again after ?kind=page; /api/health agrees", async ({ page }) => {
    const { edit } = await seed(page, "kind");
    expect(await served(page, edit)).toBe("page");
    expect(await healthSays(page.request)).toBe("page");

    // page.request shares the page's cookies, so the development cookie applies to the page too.
    await page.request.get("/dev/editor?kind=classic");
    expect(await served(page, edit)).toBe("classic");
    expect(await healthSays(page.request)).toBe("classic");
    // The line with the way back is only for a visit that asked for the classic editor by its address.
    await expect(page.getByText(LINE)).toHaveCount(0);

    await page.request.get("/dev/editor?kind=page");
    expect(await served(page, edit)).toBe("page");
    expect(await healthSays(page.request)).toBe("page");
  });

  test("one browser choosing the classic editor leaves a fresh one on the new editor", async ({ page, browser }) => {
    const { username, edit } = await seed(page, "fresh");
    const mine = await browser.newContext();
    const other = await browser.newContext();
    try {
      const a = await mine.newPage();
      const b = await other.newPage();
      await signIn(a, username);
      await signIn(b, username);
      await mine.request.get("/dev/editor?kind=classic");
      expect(await served(a, edit)).toBe("classic");
      expect(await served(b, edit)).toBe("page");
      expect(await healthSays(other.request)).toBe("page");
    } finally {
      await mine.close();
      await other.close();
    }
  });

  test("?editor=classic serves the classic editor for that visit, with a line whose way back works", async ({ page }) => {
    const { edit } = await seed(page, "escape");
    expect(await served(page, `${edit}?editor=classic`)).toBe("classic");
    await expect(page.locator(CLASSIC).getByText(LINE)).toBeVisible();
    await page.getByRole("link", { name: "Back to the new editor" }).click();
    await expect(page.locator(NEW_READY)).toBeAttached();
    expect(new URL(page.url()).search).toBe("");
    await expect(page.locator(CLASSIC)).toHaveCount(0);
  });

  test("the new editor is never drawn on the server: the page arrives with the loading view", async ({ page }) => {
    const { edit } = await seed(page, "server");
    const html = await (await page.request.get(edit)).text();
    expect(html).toContain('data-editor="page"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-ready="true"');
    // The loading view is the stand-in page: the doc's words, and the "Add a skill" box at the end of the pills.
    expect(html).toContain("Shorter queues");
    expect(html).toContain("Add a skill");
  });
});

test.describe("flushPending, in-process", () => {
  test("sends the newest doc only through the editor of the same exhbt", async () => {
    const sent: string[] = [];
    // Visit A changes its doc, and its save never lands; then visit B is opened (by a link, so the module stays).
    notePending({ ...doc(), title: "A's words" }, "exhbt-a");
    const off = registerSender({ id: "exhbt-b", send: async (d) => (sent.push(d.title), true), settled: async () => {} });
    await flushPending();
    expect(sent, "B's editor never sends A's doc").toEqual([]);
    // B's own newest doc it does send.
    notePending({ ...doc(), title: "B's words" }, "exhbt-b");
    await flushPending();
    expect(sent).toEqual(["B's words"]);
    // Once the server has it, nothing more is sent.
    await flushPending();
    expect(sent).toEqual(["B's words"]);
    off();
  });
});

test.describe("the crash fallback", () => {
  test("a throw while the new editor draws (?crash=render) shows the notice, then opens the classic editor", async ({ page }) => {
    const { edit } = await seed(page, "crash");
    const logged: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") logged.push(m.text());
    });
    const shown = await watchNotice(page);
    await page.goto(`${edit}?crash=render`);
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    await expect.poll(() => shown).toEqual([NOTICE]);
    const url = new URL(page.url());
    expect(url.pathname).toBe(edit);
    expect(url.searchParams.get("editor")).toBe("classic");
    expect(url.searchParams.has("crash")).toBe(false);
    await expect(page.getByText(LINE)).toBeVisible();
    expect(logged.some((l) => l.includes("The new editor failed"))).toBe(true);
  });

  test("a throw after the first change (?crash=change) ends in the classic editor with the words typed before it, stored and in its fields", async ({ page }) => {
    const { edit } = await seed(page, "change");
    const shown = await watchNotice(page);
    await page.goto(`${edit}?crash=change`);
    await expect(page.locator(NEW_READY)).toBeAttached();
    // One change: the whole title at once, as a paste would put it.
    await page.locator(`${NEW_READY} #title`).fill("Shorter queues at lunch");
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    await expect.poll(() => shown).toEqual([NOTICE]);
    expect(new URL(page.url()).searchParams.get("editor")).toBe("classic");
    // The newest doc was sent before the reload (flushPending), so the server has the words, and the classic editor shows them.
    const id = edit.split("/")[2]!;
    const stored = (await (await page.request.get(`/dev/parity?id=${id}`)).json()) as { working: ExhbtDoc };
    expect(stored.working.title).toBe("Shorter queues at lunch");
    await expect(page.locator(`${CLASSIC} #title`)).toHaveValue("Shorter queues at lunch");
  });

  test("a crash straight after a draft opens the classic editor for the rest of the visit", async ({ page }) => {
    const { edit } = await seed(page, "drafted");
    await page.goto(`${edit}?drafted=case-study&why=default&crash=render`);
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    // The classic editor takes what the draft page passed on off the address, and with it anything else in the
    // query; so the fallback leaves those out, and ?editor=classic stays. A reload is still the classic editor.
    expect(new URL(page.url()).search).toBe("?editor=classic");
    await page.reload();
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    await expect(page.locator('[data-editor="page"]')).toHaveCount(0);
  });

  test("an editor chunk that fails to load opens the classic editor too", async ({ page }) => {
    const { edit } = await seed(page, "chunk");
    // In development the editor's chunk is named after its file (components/exhbt-editor/EditorShell.tsx).
    await page.route(/EditorShell/, (route) => route.abort());
    expect(await served(page, edit)).toBe("classic");
    expect(new URL(page.url()).searchParams.get("editor")).toBe("classic");
  });

  // A page being left can lose a chunk that is on its way, and the next page can take far longer than a chunk's three
  // tries (components/exhbt-editor/again.ts; what was and was not seen is in leaving.ts, "What was seen"). Here any
  // browser is made to do the same: the next page is held back for eight seconds, and from the moment the person leaves, the
  // formatted fields' chunk fails each time it is asked for. The page that was left opens nothing after it.
  test("a chunk cut off by leaving the page opens no classic editor, however long the next page takes, up to a minute", async ({ page }) => {
    const { edit } = await seed(page, "leave");
    const fellBack: string[] = [];
    const navigated: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && m.text().includes("The new editor failed")) fellBack.push(m.text());
    });
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navigated.push(f.url());
    });
    // In development the chunk is named after its file (components/exhbt-editor/fields/RichEditor.tsx). It is on its
    // way and does not come; once the person has left it fails, and so does every asking after.
    let asked = 0;
    let gone = false;
    let failedAfter = 0;
    let leave!: () => void;
    const left = new Promise<void>((done) => (leave = done));
    await page.route(/RichEditor/, async (route) => {
      asked++;
      if (!gone) await left;
      failedAfter++;
      await route.abort().catch(() => {});
    });
    await page.goto(edit);
    await expect(page.locator(NEW_READY)).toBeAttached();
    await expect.poll(() => asked).toBeGreaterThan(0);
    // The list, the next page, is eight seconds on its way: the person has left once its request goes out.
    await page.route(/\/exhbts$/, async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      gone = true;
      leave();
      await new Promise((done) => setTimeout(done, 8000));
      await route.continue();
    });
    await page.goto("/exhbts");
    await expect(page.getByRole("heading", SEL.listHeading)).toBeVisible();
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/exhbts");
    // And no navigation during the hold went to the classic editor (?editor=classic): the fallback's redirect is what
    // interrupted the navigation the person asked for (the WebKit run of 27 Nov 2026).
    expect(navigated.filter((u) => new URL(u).searchParams.has("editor")), "no navigation to the classic editor").toEqual([]);
    expect(failedAfter, "the chunk was cut off by the leave").toBeGreaterThan(0);
    expect(fellBack).toEqual([]);
  });

  test("a page that fails on the server (?crash=server) shows the route's error page, with the way to the classic editor", async ({ page }) => {
    const { edit } = await seed(page, "server");
    await page.goto(`${edit}?crash=server`);
    await expect(page.getByText(NOTICE)).toBeVisible();
    const link = page.getByRole("link", { name: "Use the classic editor" });
    await expect(link).toHaveAttribute("href", `${edit}?editor=classic`);
    await link.click();
    await expect(page.locator(CLASSIC_READY)).toBeAttached();
    expect(new URL(page.url()).search).toBe("?editor=classic");

    // When it was the classic editor that was asked for, the error page offers Reload instead.
    await page.goto(`${edit}?crash=server&editor=classic`);
    await expect(page.getByText("Something went wrong with the classic editor. Your work is saved.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Use the classic editor" })).toHaveCount(0);
  });

  // The live site serves the classic editor to everyone until the new one is switched on, with nothing in the address. The
  // error page went by the address alone, so it told them the new editor had failed, and offered them the one they were in.
  test("in the classic editor the switch serves, with nothing in the address, the route's error page names it and offers Reload", async ({ page }) => {
    const CLASSIC_NOTICE = "Something went wrong with the classic editor. Your work is saved.";
    const { edit } = await seed(page, "serverswitch");
    const id = edit.split("/")[2]!;
    const saysClassic = async (why: string) => {
      await page.goto(`${edit}?crash=server`);
      await expect(page.getByText(CLASSIC_NOTICE), why).toBeVisible();
      await expect(page.getByRole("button", { name: "Reload" }), why).toBeVisible();
      await expect(page.getByText(NOTICE), why).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Use the classic editor" }), why).toHaveCount(0);
    };

    // What everyone gets: here the cookie stands in for EXHBT_EDITOR, in this browser only.
    await keepClassic(page);
    expect(await served(page, edit)).toBe("classic");
    await saysClassic("the classic editor for everyone");

    // An admin's own choice, while everyone else gets the new editor; and the new editor's words once they choose it.
    expect(await (await page.request.get("/dev/editor?kind=page")).json()).toEqual({ editor: "page" });
    expect((await page.request.get("/dev/admin?role=admin")).status()).toBe(200);
    expect((await page.request.post("/api/exhbts/editor", { form: { kind: "classic", exhbt: id }, maxRedirects: 0 })).status()).toBe(303);
    expect(await served(page, edit)).toBe("classic");
    await saysClassic("an admin who chose the classic editor");
    expect((await page.request.post("/api/exhbts/editor", { form: { kind: "page", exhbt: id }, maxRedirects: 0 })).status()).toBe(303);
    expect(await served(page, edit)).toBe("page");
    await page.goto(`${edit}?crash=server`);
    await expect(page.getByText(NOTICE)).toBeVisible();
    await expect(page.getByRole("link", { name: "Use the classic editor" })).toHaveAttribute("href", `${edit}?editor=classic`);
  });
});
