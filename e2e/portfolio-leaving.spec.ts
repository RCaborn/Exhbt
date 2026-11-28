import { devices, type Page, type Request, type Route } from "@playwright/test";
import { FULL } from "./fixtures/portfolio-pages";
import { READY, expect, fresh, openEditor, saveState, setKind, test, textbox, typeIn, valueAt, waitReady, waitSaved, type Seeded } from "./portfolio-editor";

/*
 * Leaving the one-page portfolio editor with words not yet saved (decision 0031, "Saving"; components/portfolio-editor/
 * leaving.ts). The editor sends the whole state 0.6s after the last key (useBuilder), and a person may follow a link
 * inside that wait, or while a save is on its way. Whichever way they leave, their words must be there when they come
 * back:
 *  - by a link inside the app (a client-side navigation: the page stays until the next one has come, so a save on its
 *    way goes on), the words wait for the next page and go as the editor goes, to the next page's address. They are not
 *    sent at the press: Next's navigation goes ahead of a save sent then, and Next asks for the next page a second time
 *    and shows it only once that is answered. A tab closed before the next page comes keeps them, as a full load does;
 *  - by a link to this same page, which Next fetches afresh, the same, once the page has come again;
 *  - by a full page load (the page goes, and the browser drops whatever it had not sent), what the server had not said
 *    it had is kept in this browser and offered back on the next visit, once.
 * One save at a time: the newest words are what the server keeps.
 *
 * Each test prints what it saw ("[leaving] …": every save with the address it went to and how it ended, any dialog
 * the browser showed, what the server had afterwards), so a run is the evidence of what a person gets. The pages a
 * test leaves to are asked for once first, so a development server's first build of them is not what is measured.
 */

// A development server builds each page the first time it is asked for: the first test here can wait on three.
test.describe.configure({ timeout: 180_000 });

const HEADLINE = "profile.headline";
const NAME = "profile.name";

type Save = { url: string; request: Request; at: number; ended?: "answered" | "failed"; status?: number; error?: string };

/** Every save this browser sends from now on (a server action: a POST with Next's next-action header), with where it went, when it was sent (the clock's time) and how it ended. */
function watchSaves(page: Page): Save[] {
  const saves: Save[] = [];
  page.context().on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) saves.push({ url: new URL(r.url()).pathname, request: r, at: r.timing().startTime > 0 ? r.timing().startTime : Date.now() });
  });
  page.context().on("response", (res) => {
    const s = saves.find((x) => x.request === res.request());
    if (s) s.status = res.status();
  });
  page.context().on("requestfinished", (r) => {
    const s = saves.find((x) => x.request === r);
    if (s) s.ended = "answered";
  });
  page.context().on("requestfailed", (r) => {
    const s = saves.find((x) => x.request === r);
    if (!s) return;
    s.ended = "failed";
    s.error = r.failure()?.errorText;
  });
  return saves;
}

const told = (saves: Save[]) => saves.map((s) => `POST ${s.url}${s.status ? ` ${s.status}` : ""} ${s.ended ?? "on its way"}${s.error ? ` (${s.error})` : ""}`);

/** Every dialog the browser shows ("Leave site?" is accepted, as a person who meant to leave does). */
function watchDialogs(page: Page): string[] {
  const seen: string[] = [];
  page.on("dialog", (d) => {
    seen.push(d.type());
    void d.accept();
  });
  return seen;
}

/** What the page says in its console as an error, and what it throws. */
function watchConsole(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") seen.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => seen.push(`thrown: ${e.message.slice(0, 200)}`));
  return seen;
}

/** Holds the requests `pick` chooses until `release`: a slow connection, or a busy server. */
async function hold(page: Page, pick: (r: Request) => boolean) {
  const held: Route[] = [];
  let open = false;
  await page.context().route("**/*", (route) => {
    if (open || !pick(route.request())) return route.fallback();
    held.push(route);
  });
  return {
    held,
    /** Lets the held requests go on, and every later one straight through. */
    release: async () => {
      open = true;
      for (const r of held.splice(0)) await r.continue().catch(() => {});
    },
  };
}
const isSave = (r: Request) => r.method() === "POST" && Boolean(r.headers()["next-action"]);
/** Next's request for the page it is going to (its React Server Components payload). */
const isNextPage = (path: RegExp) => (r: Request) => r.method() === "GET" && Boolean(r.headers()["rsc"]) && path.test(new URL(r.url()).pathname);
/** The same, leaving out Next's prefetches: what it asks for as it goes there, or as it asks for the page again. */
const isGoingTo = (path: RegExp) => (r: Request) => isNextPage(path)(r) && !r.headers()["next-router-prefetch"];

/** Lets the first request `pick` chooses through, and holds every one after it until `release`. */
async function holdAfterTheFirst(page: Page, pick: (r: Request) => boolean) {
  const held: Route[] = [];
  let seen = 0;
  let open = false;
  await page.context().route("**/*", (route) => {
    if (!pick(route.request())) return route.fallback();
    seen++;
    if (open || seen === 1) return route.fallback();
    held.push(route);
  });
  return {
    /** How many `pick` has chosen so far. */
    count: () => seen,
    held,
    release: async () => {
      open = true;
      for (const r of held.splice(0)) await r.continue().catch(() => {});
    },
  };
}

/** The clock's time of the next press on the page, read before any of the page's own handlers hear it. */
async function nextPressTime(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    window.addEventListener("click", () => void ((window as { __pressedAt?: number }).__pressedAt ??= Date.now()), { capture: true, once: true });
  });
  return () => page.evaluate(() => (window as { __pressedAt?: number }).__pressedAt ?? NaN);
}

/** Asks for each page once, as the person signed in, so a development server has built it before it is measured. */
async function warm(page: Page, paths: string[]) {
  for (const p of paths) expect((await page.request.get(p, { timeout: 150_000 })).status(), `${p} is up`).toBeLessThan(500);
}

/**
 * After a client-side navigation the editor's notes on its saves are still in the page (components/portfolio-editor/
 * pending.ts): whether the server has said it has the newest words. True once it has, within `ms`.
 */
async function serverHasIt(page: Page, ms = 20_000): Promise<boolean> {
  return expect
    .poll(() => page.evaluate(() => window.__portfolioEditor?.waiting() === false), { timeout: ms })
    .toBe(true)
    .then(() => true)
    .catch(() => false);
}

/** Waits until no save is on its way (answered or dropped), up to `ms`. */
async function settled(saves: Save[], ms = 20_000) {
  await expect.poll(() => saves.every((s) => s.ended), { timeout: ms }).toBe(true).catch(() => {});
}

/** What the server has: the editor opened afresh, by its address, and the headline it shows. */
async function storedHeadline(page: Page): Promise<unknown> {
  await page.goto("/portfolio");
  await waitReady(page);
  return valueAt(page, HEADLINE);
}

/** The offer of kept words on the editor's page now, if any: its reason. */
const offerWhy = (page: Page) => page.locator("[data-kept-offer]").getAttribute("data-kept-why", { timeout: 2_000 }).catch(() => null);

type Back = { opened: boolean; shown?: unknown; offer?: string | null; couldNotFetch?: boolean };

/**
 * Back to the editor by the header's "Your portfolio", as a person comes back (a client-side navigation: the page
 * keeps its notes on the saves still on their way, and the gate waits for them). Whether the editor opened within
 * 30 seconds, what the headline shows, and any offer of kept words; or whether the gate said it could not fetch the page.
 */
async function backByTheHeader(page: Page): Promise<Back> {
  await page.getByRole("link", { name: "Your portfolio", exact: true }).first().click();
  const opened = await page
    .locator(READY)
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) return { opened, couldNotFetch: await page.locator("[data-stale-data]").isVisible().catch(() => false) };
  return { opened, shown: await valueAt(page, HEADLINE), offer: await offerWhy(page) };
}

/** On the editor's page: the newer words are there, or offered back; put back, they are saved. */
async function expectNewerWords(page: Page, back: Back, words: string) {
  if (back.shown === words) return;
  expect(back.offer, "not saved, so offered back").toBe("left");
  await page.locator("[data-kept-offer]").getByRole("button", { name: "Put back your last changes" }).click();
  await expect(textbox(page, HEADLINE)).toHaveValue(words);
  await waitSaved(page);
  expect(await storedHeadline(page)).toBe(words);
}

/** Prints what a test saw, for the run's output, whatever the test's result. */
function say(what: string, facts: Record<string, unknown>) {
  console.log(`[leaving] ${what}: ${JSON.stringify(facts)}`);
}

/** The links inside the app a person follows out of the editor: the Add tile, a tile's own link, the header's. */
const LINKS: { name: string; follow(page: Page): Promise<void>; lands: RegExp; path(s: Seeded): string }[] = [
  { name: "the Add tile", follow: (page) => page.locator(`${READY} [data-owner] a[href="/exhbts/new"]`).first().click(), lands: /\/exhbts\/new$/, path: () => "/exhbts/new" },
  {
    name: "a tile's own link to its exhbt",
    follow: (page) => page.locator(`${READY} [data-tile-frame] [data-pe-open]`).first().click(),
    lands: /\/exhbts\/[0-9a-f-]{36}\/edit$/,
    path: (s) => `/exhbts/${Object.values(s.ids)[0]}/edit`,
  },
  { name: "the header's Roadmaps", follow: (page) => page.getByRole("link", { name: "Roadmaps", exact: true }).first().click(), lands: /\/roadmap$/, path: () => "/roadmap" },
];
const ADD = LINKS[0]!;
const ROADMAPS = LINKS[2]!;

test.describe("Words typed just before a link inside the app is followed", () => {
  for (const link of LINKS) {
    test(`${link.name}: they wait for the next page, go as the editor goes, and are there when the person comes back`, async ({ page }) => {
      const seeded = await openEditor(page, fresh(FULL, `lv-${link.name}`));
      await warm(page, [link.path(seeded)]);
      const saves = watchSaves(page);
      const errors = watchConsole(page);
      const words = `Typed just before ${link.name}`;
      const facts: Record<string, unknown> = {};
      try {
        await typeIn(page, HEADLINE, words);
        // Inside the autosave's wait: nothing of these words has gone yet.
        facts.sentBeforeTheLink = saves.length;
        await link.follow(page);
        await page.waitForURL(link.lands, { timeout: 60_000 });
        facts.landedOn = new URL(page.url()).pathname;
        facts.serverHasIt = await serverHasIt(page);
        await settled(saves);
        facts.saves = told(saves);
        facts.errors = errors;
        facts.stored = await storedHeadline(page);
      } finally {
        say(link.name, facts);
      }
      expect(facts.sentBeforeTheLink, "no save had gone when the link was followed").toBe(0);
      // Not at the press: a save sent then is one Next's navigation goes ahead of, and Next asks for the next page twice.
      expect(
        saves.map((s) => s.url),
        "one save, sent as the editor went: once the next page had come, to its address",
      ).toEqual([facts.landedOn]);
      expect(facts.stored).toBe(words);
    });
  }

  test("the next page is asked for once, and shown without waiting for a second request", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-once"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    // Next's requests for the next page: the first goes through, and any after it (a refresh of the page it lands on) is held.
    const asked = await holdAfterTheFirst(page, isGoingTo(/^\/exhbts\/new$/));
    const pressedAt = await nextPressTime(page);
    const words = "Typed just before the Add tile, asked for once";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      await ADD.follow(page);
      // A shown page that waits for nothing more takes a second or so here; eight is far past it.
      facts.shownWhileASecondRequestWasHeld = await page
        .waitForURL(ADD.lands, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      facts.askedFor = asked.count();
      const at = await pressedAt();
      facts.sentBeforeThePress = saves.filter((s) => s.at < at).length;
      await asked.release();
      await page.waitForURL(ADD.lands, { timeout: 60_000 });
      facts.serverHasIt = await serverHasIt(page);
      await settled(saves);
      facts.saves = told(saves);
      facts.stored = await storedHeadline(page);
    } finally {
      say("the next page, asked for once", facts);
    }
    // What this case is about: the words were waiting at the press. A save already on its way there is another case.
    expect(facts.sentBeforeThePress, "no save had gone at the press").toBe(0);
    expect(facts.askedFor, "Next asked for the next page once").toBe(1);
    expect(facts.shownWhileASecondRequestWasHeld, "and showed it without waiting for a second request").toBe(true);
    expect(facts.stored).toBe(words);
  });

  test("a next page slow to come: the words wait for it, and go as it comes", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-slow-next"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    const next = await hold(page, isNextPage(/^\/exhbts\/new$/));
    const words = "Typed just before a slow next page";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      await ADD.follow(page);
      await expect.poll(() => next.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      // The next page has not come. Two seconds is well past the autosave's wait: what has gone by now?
      await page.waitForTimeout(2_000);
      facts.sentWhileItWasComing = told(saves);
      await next.release();
      await page.waitForURL(ADD.lands, { timeout: 60_000 });
      facts.serverHasIt = await serverHasIt(page);
      await settled(saves);
      facts.saves = told(saves);
      facts.stored = await storedHeadline(page);
    } finally {
      say("a slow next page", facts);
    }
    expect(facts.sentWhileItWasComing, "nothing went while the next page was coming").toEqual([]);
    expect(saves.map((s) => s.url), "one save, sent as the editor went, to the next page's address").toEqual(["/exhbts/new"]);
    expect(facts.stored).toBe(words);
  });

  test("a next page slow to come, and the person reloads the page while it is coming: the words are not lost", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-slow-reload"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    const dialogs = watchDialogs(page);
    const next = await hold(page, isNextPage(/^\/exhbts\/new$/));
    const words = "Typed, then the next page was slow, then a reload";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      await ADD.follow(page);
      await expect.poll(() => next.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      await page.waitForTimeout(2_000);
      facts.sentBeforeTheReload = told(saves);
      // Still on /portfolio (the next page never came): a reload, as a person who gives up does.
      await page.reload();
      await waitReady(page);
      facts.dialogs = dialogs;
      facts.shown = await valueAt(page, HEADLINE);
      facts.offer = await offerWhy(page);
    } finally {
      say("a slow next page, then a reload", facts);
    }
    expect(facts.shown === words || facts.offer === "left", "saved, or kept and offered back").toBe(true);
  });
});

test.describe("A save on its way when the person leaves", () => {
  test("by a link inside the app: the save still lands, and the words are there when they come back", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-inflight-link"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    const held = await hold(page, isSave);
    const words = "Sent before the link, answered after it";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      await ADD.follow(page);
      await page.waitForURL(ADD.lands, { timeout: 60_000 });
      await held.release();
      facts.serverHasIt = await serverHasIt(page);
      await settled(saves);
      facts.saves = told(saves);
      facts.stored = await storedHeadline(page);
    } finally {
      say("on its way, then a link", facts);
    }
    expect(facts.stored).toBe(words);
  });

  test("with newer words waiting behind it: the older save lands first, and the newer words are saved after it or offered back, never lost", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-order"));
    await warm(page, [ROADMAPS.path(seeded), "/roadmap/new"]);
    const saves = watchSaves(page);
    const held = await hold(page, isSave);
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "The older words");
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      // Typed while the first save is on its way: they wait for it (one save at a time).
      await typeIn(page, HEADLINE, "The newer words");
      await ROADMAPS.follow(page);
      await page.waitForURL(ROADMAPS.lands, { timeout: 60_000 });
      await held.release();
      facts.serverHasIt = await serverHasIt(page);
      await settled(saves);
      facts.saves = told(saves);
      facts.back = await backByTheHeader(page);
    } finally {
      say("on its way with newer words waiting, then a link", facts);
    }
    expect(facts.back, "back by the header's link, the editor opens, with the newer words or an offer of them").toEqual(expect.objectContaining({ opened: true }));
    await expectNewerWords(page, facts.back as Back, "The newer words");
  });

  test("newer words asked for while the navigation is under way (Next drops a save asked for then): they wait for the next page, then go, and are saved", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-lost"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    const held = await hold(page, isSave);
    const next = await hold(page, isNextPage(/^\/exhbts\/new$/));
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "The older words");
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      await typeIn(page, HEADLINE, "The newer words");
      // The link, with the next page held: the navigation goes ahead of the save on its way.
      await ADD.follow(page);
      await expect.poll(() => next.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      // The older save is answered while the navigation is still under way, so the newer one is asked for then.
      await held.release();
      await expect.poll(() => saves[0]?.ended, { timeout: 20_000 }).toBeDefined();
      await page.waitForTimeout(1_000);
      facts.sentWhileItWasComing = told(saves);
      await next.release();
      await page.waitForURL(ADD.lands, { timeout: 60_000 });
      facts.serverHasIt = await serverHasIt(page);
      await settled(saves);
      facts.saves = told(saves);
      facts.back = await backByTheHeader(page);
    } finally {
      say("newer words asked for while the navigation was under way", facts);
    }
    expect(facts.sentWhileItWasComing, "the newer save waited while the next page was coming").toEqual([expect.stringMatching(/^POST \/portfolio 200 /)]);
    expect(facts.serverHasIt, "the newer save went once the next page had come, and landed").toBe(true);
    expect(facts.back, "back by the header's link, the editor opens on the newer words, with nothing to offer back").toEqual({ opened: true, shown: "The newer words", offer: null });
  });

  test("newer words asked for while the header's Roadmaps is under way: they go in the moment the editor goes, and are saved", async ({ page }) => {
    await openEditor(page, fresh(FULL, "lv-lost-roadmap"));
    await warm(page, ["/roadmap", "/roadmap/new"]);
    const saves = watchSaves(page);
    const held = await hold(page, isSave);
    const next = await hold(page, isNextPage(/^\/roadmap$/));
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "The older words");
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      await typeIn(page, HEADLINE, "The newer words");
      await ROADMAPS.follow(page);
      await expect.poll(() => next.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      // The older save is answered while the navigation is under way, so the newer one is asked for then.
      await held.release();
      await expect.poll(() => saves[0]?.ended, { timeout: 20_000 }).toBeDefined();
      await page.waitForTimeout(1_000);
      await next.release();
      await page.waitForURL(/\/roadmap(\/new)?$/, { timeout: 60_000 });
      facts.serverHasIt = await serverHasIt(page);
      facts.landedOn = new URL(page.url()).pathname;
      await settled(saves);
      facts.saves = told(saves);
      facts.back = await backByTheHeader(page);
    } finally {
      say("newer words asked for while Roadmaps was under way", facts);
    }
    expect(facts.serverHasIt, "the newer save went as the editor went, and landed").toBe(true);
    expect(facts.back, "back by the header's link, the editor opens on the newer words, with nothing to offer back").toEqual({ opened: true, shown: "The newer words", offer: null });
  });

  test("the same for a person with no roadmap yet, whom Roadmaps sends on to /roadmap/new: the newer words are saved", async ({ page }) => {
    await setKind(page, "page");
    const email = `pe-lv-noroadmap-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await page.goto(`/auth/dev?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/portfolio")}`);
    await waitReady(page);
    await warm(page, ["/roadmap", "/roadmap/new"]);
    const saves = watchSaves(page);
    const held = await hold(page, isSave);
    const next = await hold(page, isNextPage(/^\/roadmap(\/new)?$/));
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "The older words");
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      await typeIn(page, HEADLINE, "The newer words");
      await ROADMAPS.follow(page);
      await expect.poll(() => next.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      await held.release();
      await expect.poll(() => saves[0]?.ended, { timeout: 20_000 }).toBeDefined();
      await page.waitForTimeout(1_000);
      await next.release();
      await page.waitForURL(/\/roadmap\/new/, { timeout: 60_000 });
      facts.serverHasIt = await serverHasIt(page);
      facts.landedOn = new URL(page.url()).pathname;
      await settled(saves);
      facts.saves = told(saves);
      facts.back = await backByTheHeader(page);
    } finally {
      say("newer words asked for while Roadmaps was under way, no roadmap yet", facts);
    }
    expect(facts.serverHasIt, "the newer save went as the editor went, and landed").toBe(true);
    expect(facts.back, "back by the header's link, the editor opens on the newer words, with nothing to offer back").toEqual({ opened: true, shown: "The newer words", offer: null });
  });

  test("words typed while the next page is coming, after words that were waiting at the press: the newest go as it comes, and are saved", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-meanwhile"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    const next = await hold(page, isNextPage(/^\/exhbts\/new$/));
    const words = "Typed while the next page was coming";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "Typed just before the link");
      // Inside the autosave's wait: these words wait for the next page.
      await ADD.follow(page);
      await expect.poll(() => next.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      // Still on the editor (the next page has not come): more words, and well past the autosave's wait.
      await typeIn(page, HEADLINE, words);
      await page.waitForTimeout(2_000);
      facts.sentWhileItWasComing = told(saves);
      await next.release();
      await page.waitForURL(ADD.lands, { timeout: 60_000 });
      facts.serverHasIt = await serverHasIt(page);
      await settled(saves);
      facts.saves = told(saves);
      facts.back = await backByTheHeader(page);
    } finally {
      say("typed while the next page was coming", facts);
    }
    expect(facts.sentWhileItWasComing, "nothing went while the next page was coming").toEqual([]);
    expect(saves.map((s) => s.url), "one save, of the newest words, sent as the editor went").toEqual(["/exhbts/new"]);
    expect(facts.serverHasIt, "the words typed meanwhile went once the next page had come, and landed").toBe(true);
    expect(facts.back, "back by the header's link, the editor opens on them, with nothing to offer back").toEqual({ opened: true, shown: words, offer: null });
  });

  test("a reload answered Stay while the next page is coming, with newer words behind a save on its way: they still wait for the next page, and are saved", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-stay-reload"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.type());
      // Stays on the page.
      void d.dismiss();
    });
    const held = await hold(page, isSave);
    const next = await hold(page, isNextPage(/^\/exhbts\/new$/));
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "The older words");
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      await typeIn(page, HEADLINE, "The newer words");
      // The link, with the next page held: the navigation goes ahead of the save on its way.
      await ADD.follow(page);
      await expect.poll(() => next.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      // A reload while it is coming (the browser asks first, as a change is waiting), and the person stays.
      await page.evaluate(() => void setTimeout(() => window.location.reload(), 0));
      await expect.poll(() => dialogs.length, { timeout: 10_000 }).toBeGreaterThan(0);
      await page.waitForTimeout(500);
      facts.dialogs = [...dialogs];
      facts.stillOn = new URL(page.url()).pathname;
      // The older save is answered while the navigation is still under way, so the newer one is asked for then.
      await held.release();
      await expect.poll(() => saves[0]?.ended, { timeout: 20_000 }).toBeDefined();
      await page.waitForTimeout(1_000);
      facts.sentWhileItWasComing = told(saves);
      await next.release();
      await page.waitForURL(ADD.lands, { timeout: 60_000 });
      facts.serverHasIt = await serverHasIt(page);
      await settled(saves);
      facts.saves = told(saves);
      facts.back = await backByTheHeader(page);
    } finally {
      say("a reload answered Stay while the next page was coming", facts);
    }
    expect(facts.dialogs, "the browser asked before the reload").toEqual(["beforeunload"]);
    expect(facts.stillOn, "and the person stayed").toBe("/portfolio");
    expect(facts.sentWhileItWasComing, "the newer save waited while the next page was coming").toEqual([expect.stringMatching(/^POST \/portfolio 200 /)]);
    expect(facts.serverHasIt, "the newer save went once the next page had come, and landed").toBe(true);
    expect(facts.back, "back by the header's link, the editor opens on the newer words, with nothing to offer back").toEqual({ opened: true, shown: "The newer words", offer: null });
  });

  test("by a full page load: the words the server did not get are kept in this browser and offered back once", async ({ page }) => {
    await openEditor(page, fresh(FULL, "lv-inflight-load"));
    await warm(page, ["/account"]);
    const before = await valueAt(page, HEADLINE);
    const saves = watchSaves(page);
    const dialogs = watchDialogs(page);
    const held = await hold(page, isSave);
    const words = "Sent, then the page was left by a full load";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      // A full page load the page starts itself, as an address typed does.
      await page.evaluate(() => window.location.assign("/account"));
      await page.waitForURL(/\/account$/, { timeout: 60_000 });
      await held.release();
      await settled(saves);
      facts.saves = told(saves);
      facts.dialogs = dialogs;
      await page.goto("/portfolio");
      await waitReady(page);
      facts.shown = await valueAt(page, HEADLINE);
      facts.offer = await offerWhy(page);
    } finally {
      say("on its way, then a full page load", facts);
    }
    // The server never had them (the browser dropped the save as the page went): the page opens on what it has…
    expect(facts.shown).toBe(before);
    // …and offers the kept words, once.
    expect(facts.offer).toBe("left");
    await page.locator("[data-kept-offer]").getByRole("button", { name: "Put back your last changes" }).click();
    await expect(textbox(page, HEADLINE)).toHaveValue(words);
    await waitSaved(page);
    expect(await storedHeadline(page)).toBe(words);
    expect(await offerWhy(page), "offered once").toBe(null);
  });

  test("slower than the gate's wait, left by a link and back by the header: the editor does not open on older words while it can still land, and the newer edit is what the server keeps", async ({ page }) => {
    await openEditor(page, fresh(FULL, "lv-slow-save"));
    await warm(page, ["/roadmap", "/roadmap/new"]);
    const saves = watchSaves(page);
    // Only the first save is held (a slow connection, or a busy server, for that one request); every later one goes through.
    const slow: { route?: Route } = {};
    await page.context().route("**/*", (route) => {
      if (!slow.route && isSave(route.request())) {
        slow.route = route;
        return;
      }
      return route.fallback();
    });
    const first = "Headline typed in the first visit";
    const second = "Name typed in the second visit";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, first);
      await expect.poll(() => Boolean(slow.route), { timeout: 10_000 }).toBe(true);
      await ROADMAPS.follow(page);
      await page.waitForURL(/\/roadmap(\/new)?$/, { timeout: 60_000 });
      await page.getByRole("link", { name: "Your portfolio", exact: true }).first().click();
      // Longer than the gate waits before it says it could not fetch the page (PortfolioGate.tsx, ten seconds).
      facts.openedWhileItWasOnItsWay = await page
        .locator(READY)
        .waitFor({ timeout: 12_000 })
        .then(() => true)
        .catch(() => false);
      facts.saidSo = await page
        .locator("[data-stale-data]")
        .waitFor({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      // The slow save reaches the server now.
      await slow.route?.continue();
      facts.opened = await page
        .locator(READY)
        .waitFor({ timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (facts.opened) {
        facts.shown = await valueAt(page, HEADLINE);
        facts.offer = await offerWhy(page);
        // The person edits on.
        await typeIn(page, NAME, second);
        await waitSaved(page);
      }
      await settled(saves);
      facts.saves = told(saves);
      await page.goto("/portfolio");
      await waitReady(page);
      facts.stored = { headline: await valueAt(page, HEADLINE), name: await valueAt(page, NAME) };
      facts.offerAfter = await offerWhy(page);
    } finally {
      say("a save slower than the gate's wait, left and back", facts);
    }
    expect(facts.openedWhileItWasOnItsWay, "the editor stays shut while the first visit's save can still land").toBe(false);
    expect(facts.saidSo, "and the gate says it could not fetch the newest copy yet, with Try again").toBe(true);
    expect(facts.opened, "once that save has landed, the editor opens").toBe(true);
    expect(facts.shown, "on the words that save carried").toBe(first);
    expect(facts.offer, "with nothing to offer back").toBe(null);
    expect(facts.stored, "the second visit's edit is what the server keeps, over the first visit's words").toEqual({ headline: first, name: second });
    expect(facts.offerAfter, "and nothing older is offered over it").toBe(null);
  });

  test("by a reload, when the server took the save but its answer had not come back: nothing is offered back as not saved", async ({ page }) => {
    await openEditor(page, fresh(FULL, "lv-took-it"));
    const saves = watchSaves(page);
    const dialogs = watchDialogs(page);
    // The first save reaches the server and is stored; its answer is held, as on a connection that drops the reply.
    const sent = { taken: false, stored: false };
    await page.context().route("**/*", async (route) => {
      if (sent.taken || !isSave(route.request())) return route.fallback();
      sent.taken = true;
      await route
        .fetch()
        .then(() => void (sent.stored = true))
        .catch(() => {});
    });
    // Typed as a person pauses between words: the words end in a space, which the server trims as it stores them.
    const words = "Analyst in food service and ";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      await expect.poll(() => sent.stored, { timeout: 20_000 }).toBe(true);
      await page.reload();
      await waitReady(page);
      facts.dialogs = dialogs;
      facts.saves = told(saves);
      facts.shown = await valueAt(page, HEADLINE);
      facts.offer = await offerWhy(page);
    } finally {
      say("the server took it, its answer lost, then a reload", facts);
    }
    expect(facts.shown, "the server has the words, as it stores them").toBe(words.trim());
    expect(facts.offer, "so nothing is offered back as not saved").toBe(null);
  });

});

test.describe("A link to this same page (the header's Your portfolio, on /portfolio): Next asks for the page afresh", () => {
  const yourPortfolio = (page: Page) => page.getByRole("link", { name: "Your portfolio", exact: true }).first();

  test("with a save on its way and newer words waiting: the newer words wait for the page, then go, and what is typed after is saved too", async ({ page }) => {
    await openEditor(page, fresh(FULL, "lv-same-page"));
    const saves = watchSaves(page);
    const held = await hold(page, isSave);
    const again = await hold(page, isGoingTo(/^\/portfolio$/));
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "The older words");
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      await typeIn(page, HEADLINE, "The newer words");
      // The navigation goes ahead of the save on its way.
      await yourPortfolio(page).click();
      await expect.poll(() => again.held.length, { timeout: 10_000 }).toBeGreaterThan(0);
      // The older save is answered while the page is being fetched again, so the newer one is asked for then.
      await held.release();
      await expect.poll(() => saves[0]?.ended, { timeout: 20_000 }).toBeDefined();
      await page.waitForTimeout(1_000);
      facts.sentWhileItWasComing = told(saves);
      await again.release();
      facts.newerSaved = await waitSaved(page)
        .then(() => true)
        .catch(() => false);
      facts.headline = await valueAt(page, HEADLINE);
      // The person carries on.
      await typeIn(page, HEADLINE, "Typed after that");
      facts.laterSaved = await waitSaved(page)
        .then(() => true)
        .catch(() => false);
      await settled(saves);
      facts.saves = told(saves);
      facts.stored = await storedHeadline(page);
      facts.offer = await offerWhy(page);
    } finally {
      say("a link to this page, with a save on its way and newer words waiting", facts);
    }
    expect(facts.sentWhileItWasComing, "the newer save waited while the page was being fetched again").toEqual([expect.stringMatching(/^POST \/portfolio 200 /)]);
    expect(facts.newerSaved, "once the page had come, the newer words went and landed").toBe(true);
    expect(facts.headline, "on the newer words").toBe("The newer words");
    expect(facts.laterSaved, "and what is typed after is saved").toBe(true);
    expect(facts.stored).toBe("Typed after that");
    expect(facts.offer, "with nothing to offer back").toBe(null);
  });

  test("with words waiting and nothing on its way: they are saved, and so is what is typed after", async ({ page }) => {
    await openEditor(page, fresh(FULL, "lv-same-calm"));
    const saves = watchSaves(page);
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, "Typed just before the link to this page");
      facts.sentBeforeTheLink = saves.length;
      const came = page.waitForResponse((r) => isGoingTo(/^\/portfolio$/)(r.request()), { timeout: 30_000 });
      await yourPortfolio(page).click();
      await came;
      facts.firstSaved = await waitSaved(page)
        .then(() => true)
        .catch(() => false);
      await typeIn(page, HEADLINE, "Typed after the link to this page");
      facts.laterSaved = await waitSaved(page)
        .then(() => true)
        .catch(() => false);
      await settled(saves);
      facts.saves = told(saves);
      facts.stored = await storedHeadline(page);
    } finally {
      say("a link to this page, with words waiting and nothing on its way", facts);
    }
    expect(facts.sentBeforeTheLink, "no save had gone when the link was followed").toBe(0);
    expect(facts.firstSaved, "the words waiting at the press are saved").toBe(true);
    expect(facts.laterSaved, "and so is what is typed after").toBe(true);
    expect(facts.stored).toBe("Typed after the link to this page");
  });
});

test.describe("A link whose page cannot be fetched", () => {
  test("offline: Next asks for a full page load, the person stays when the browser asks Leave site?, and once the connection is back the editor saves again", async ({ page, context }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-stay"));
    await warm(page, [ADD.path(seeded)]);
    const saves = watchSaves(page);
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.type());
      // Stays on the page.
      void d.dismiss();
    });
    const words = "Typed once the connection was back";
    const facts: Record<string, unknown> = {};
    try {
      await context.setOffline(true);
      await typeIn(page, HEADLINE, "Typed with the connection gone");
      await expect(saveState(page)).toHaveAttribute("data-save", "error", { timeout: 15_000 });
      await ADD.follow(page);
      await expect.poll(() => dialogs.length, { timeout: 15_000 }).toBeGreaterThan(0);
      await page.waitForTimeout(1_000);
      facts.dialogs = [...dialogs];
      facts.stillOn = new URL(page.url()).pathname;
      await context.setOffline(false);
      await typeIn(page, HEADLINE, words);
      facts.saved = await waitSaved(page)
        .then(() => true)
        .catch(() => false);
      facts.saves = told(saves);
      facts.stored = await storedHeadline(page);
    } finally {
      say("offline, a link, and the person stays", facts);
    }
    expect(facts.dialogs, "the browser asked before leaving").toEqual(["beforeunload"]);
    expect(facts.stillOn, "and the person stayed").toBe("/portfolio");
    expect(facts.saved, "the editor saves again").toBe(true);
    expect(facts.stored).toBe(words);
  });
});

test.describe("Words typed just before a full page load", () => {
  test("are saved, or kept in this browser and offered back once", async ({ page }) => {
    await openEditor(page, fresh(FULL, "lv-load"));
    await warm(page, ["/account"]);
    const saves = watchSaves(page);
    const dialogs = watchDialogs(page);
    const words = "Typed just before a full page load";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      facts.sentBeforeTheLoad = saves.length;
      await page.evaluate(() => window.location.assign("/account"));
      await page.waitForURL(/\/account$/, { timeout: 60_000 });
      await settled(saves);
      facts.saves = told(saves);
      facts.dialogs = dialogs;
      await page.goto("/portfolio");
      await waitReady(page);
      facts.shown = await valueAt(page, HEADLINE);
      facts.offer = await offerWhy(page);
    } finally {
      say("typed, then a full page load", facts);
    }
    expect(facts.sentBeforeTheLoad, "no save had gone when the page was left").toBe(0);
    expect(facts.shown === words || facts.offer === "left", "saved, or kept and offered back").toBe(true);
    if (facts.offer === "left") {
      await page.locator("[data-kept-offer]").getByRole("button", { name: "Put back your last changes" }).click();
      await expect(textbox(page, HEADLINE)).toHaveValue(words);
    }
  });
});

// Playwright's Pixel 7 (a touch screen, 412 wide, a coarse pointer), in this project's browser.
const { defaultBrowserType: _browser, ...PHONE } = devices["Pixel 7"];
void _browser;

test.describe("On a phone: a tile's More, Open", () => {
  test.use(PHONE);
  test("with a save on its way: the browser asks nothing, the save lands, and the words are there when the person comes back", async ({ page }) => {
    const seeded = await openEditor(page, fresh(FULL, "lv-phone-open"));
    await warm(page, Object.values(seeded.ids).map((id) => `/exhbts/${id}/edit`));
    const saves = watchSaves(page);
    const dialogs = watchDialogs(page);
    const held = await hold(page, isSave);
    const words = "Typed on a phone, then Open";
    const facts: Record<string, unknown> = {};
    try {
      await typeIn(page, HEADLINE, words);
      await expect.poll(() => held.held.length, { timeout: 5_000 }).toBe(1);
      const more = page.locator(`${READY} [data-section="work"] [data-tile-frame] [data-act="more"]`).first();
      await more.scrollIntoViewIfNeeded();
      await more.tap();
      await page.getByRole("dialog").getByRole("button", { name: /^Open / }).tap();
      await page.waitForURL(/\/exhbts\/[0-9a-f-]{36}\/edit$/, { timeout: 60_000 });
      await held.release();
      await settled(saves);
      facts.saves = told(saves);
      facts.dialogs = dialogs;
      facts.stored = await storedHeadline(page);
      facts.offer = await offerWhy(page);
    } finally {
      say("phone, on its way, then More, Open", facts);
    }
    expect(facts.dialogs, "no Leave site? dialog").toEqual([]);
    expect(facts.stored).toBe(words);
  });
});
