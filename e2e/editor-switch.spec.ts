import { expect, test, type APIRequestContext } from "./editor-test";

// The switch between the two editors (lib/editor-kind.ts, release 2: nothing but /api/health reads it).
// In production it is the runtime variable EXHBT_EDITOR; in development a cookie, set by /dev/editor, overrides
// it so each browser context has its own and nothing leaks between tests. /api/health answers 503 here (there is no
// database), so these read `editor` from the body and ignore the status.

const editorOf = async (request: APIRequestContext, path = "/api/health?only=editor") => ((await request.get(path)).json() as Promise<{ editor: string }>).then((b) => b.editor);

test.describe("the editor switch", () => {
  test("is the new editor unless told otherwise, and the full health report says so too", async ({ request }) => {
    expect(await editorOf(request)).toBe("page");
    expect(await editorOf(request, "/api/health")).toBe("page");
  });

  test("a browser can choose the classic editor, and a fresh one still gets the new one", async ({ browser }) => {
    const mine = await browser.newContext();
    const other = await browser.newContext();
    try {
      const set = await mine.request.get("/dev/editor?kind=classic");
      expect(await set.json()).toEqual({ editor: "classic" });
      expect(await editorOf(mine.request)).toBe("classic");
      expect(await editorOf(mine.request, "/api/health")).toBe("classic");
      expect(await editorOf(other.request)).toBe("page");

      // An empty kind puts it back.
      expect(await (await mine.request.get("/dev/editor?kind=")).json()).toEqual({ editor: "page" });
      expect(await editorOf(mine.request)).toBe("page");

      await mine.request.get("/dev/editor?kind=classic");
      await mine.request.get("/dev/editor?kind=page");
      expect(await editorOf(mine.request)).toBe("page");
      // With no kind, it only says what is in force.
      await mine.request.get("/dev/editor?kind=classic");
      expect(await (await mine.request.get("/dev/editor")).json()).toEqual({ editor: "classic" });
    } finally {
      await mine.close();
      await other.close();
    }
  });
});
