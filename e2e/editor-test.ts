import { test as base, type Page } from "@playwright/test";

export * from "@playwright/test";

/*
 * The editor specs' `test` (every editor-*.spec.ts, and e2e/safari.webkit.ts): Playwright's own, with what a
 * run on Safari's engine needs. On Chromium, with no switch set, it is Playwright's own and nothing more.
 *
 *  - On WebKit, next dev's hot-reload client hears nothing from the server. The server tells every open page
 *    when it builds a route for the first time; a page that is being left at that moment fetches the update,
 *    WebKit fails the fetch (the page is going), the client answers by reloading the page, and WebKit lets
 *    that reload interrupt the navigation the test asked for ("Navigation to … is interrupted by another
 *    navigation"). The page still talks to the server, which keeps its entry alive there; nothing comes back.
 *    This is the development server's doing: the live site has no such client.
 *  - In the WebKit job (E2E_WEBKIT) a page's uncaught errors and its console errors go to the test's output,
 *    which the job's summary prints (scripts/e2e-summary.mjs): the job's log is all that a machine without
 *    WebKit sees of a WebKit run.
 *  - E2E_FOCUS=safari gives every page Safari's rule about the focus (safariFocus, below).
 */
export const test = base.extend({
  context: async ({ context, browserName }, run) => {
    if (browserName === "webkit") await context.routeWebSocket(/\/_next\/webpack-hmr/, (ws) => void ws.connectToServer().onMessage(() => {}));
    if (process.env.E2E_WEBKIT) context.on("page", hear);
    if (process.env.E2E_FOCUS === "safari") await context.addInitScript(safariFocus);
    await run(context);
  },
});

/**
 * Whether a press on a button gives it the focus in this run: not under Safari's rule (E2E_FOCUS=safari). A check
 * that a pressed button has the focus, or that a sheet gives the focus back to the button pressed to open it,
 * asks for something Safari never does, so it is made only where this is true.
 */
export const pressFocuses = process.env.E2E_FOCUS !== "safari";

/** Each thing a page says (an uncaught error, a console error with where it came from), once, to the test's output. */
function hear(page: Page) {
  const said = new Set<string>();
  const say = (line: string) => {
    if (said.has(line)) return;
    said.add(line);
    console.log(line);
  };
  page.on("pageerror", (e) => say(`[page error] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    say(`[console error] ${m.text().slice(0, 400)}${from ? ` (${from.replace(/^https?:\/\/[^/]+/, "")})` : ""}`);
  });
}

/**
 * Safari's rule about the focus, for a browser without it (in the page; E2E_FOCUS=safari gives it to every
 * page, and a test may add it itself with page.addInitScript). On a Mac and on an iPhone a press on a button,
 * a link, a tick box or a radio button never gives it the focus: the focus goes to the nearest thing round it
 * that takes a press (a field, anything else with a tabindex), or leaves whatever had it. A press the page has
 * already stopped (preventDefault on mousedown) changes nothing, there as here. Chromium has no such rule,
 * and nor has WebKit on Linux (scripts/webkit-probe.mjs prints what it does), so this is how a machine with
 * neither a Mac nor an iPhone sees what the rule does to the editor: a test that passes without it and fails
 * with it has found something Safari would do.
 */
export function safariFocus() {
  const SHY = "button, a[href]:not([tabindex]), input[type=checkbox], input[type=radio], input[type=button], input[type=submit], input[type=reset], input[type=file]";
  const TAKES = `${SHY}, a[href], input:not([type=hidden]), textarea, [tabindex], [contenteditable]:not([contenteditable=false])`;
  window.addEventListener("mousedown", (e) => {
    if (e.defaultPrevented || !(e.target instanceof Element)) return;
    const first = e.target.closest(TAKES);
    if (!first || !first.matches(SHY) || first.closest("select")) return;
    e.preventDefault();
    let next = first.parentElement?.closest<HTMLElement>(TAKES) ?? null;
    while (next && next.matches(SHY)) next = next.parentElement?.closest<HTMLElement>(TAKES) ?? null;
    if (next) next.focus();
    else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
  });
}
