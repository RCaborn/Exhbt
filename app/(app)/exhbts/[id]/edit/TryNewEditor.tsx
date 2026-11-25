import { Button } from "@/components/ui/Button";

/**
 * An admin's way from the classic editor to the new one (lib/editor-kind.ts; decision 0026, "Going live:
 * switched off, then on"). The edit page draws it only for a signed-in admin whose editor is the classic
 * one, in a line above the classic editor: that editor has no menu to put it in. Nobody else is sent it.
 *
 * It is a plain form, so it works before the page's scripts have loaded, and the page loads afresh:
 * POST /api/exhbts/editor stores the choice in this browser and sends the browser back to this exhbt,
 * which then opens in the new editor, as every exhbt does from then on. The classic editor's own check
 * for changes not yet saved runs, as it does for any other way off the page.
 */
export function TryNewEditor({ id }: { id: string }) {
  return (
    // editor-touch: the button is 44px on a touch screen, as the classic editor's own are (app/globals.css).
    <div className="editor-touch bg-mist" data-admin-switch>
      <form method="post" action="/api/exhbts/editor" className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-6 text-sm sm:px-8 xl:max-w-[90rem]">
        <input type="hidden" name="kind" value="page" />
        <input type="hidden" name="exhbt" value={id} />
        <span className="font-semibold">Admins only.</span>
        <Button type="submit" size="sm">
          Try the new editor
        </Button>
        <span className="text-graphite">It stays on in this browser. &ldquo;Use the classic editor&rdquo; in its menu brings you back.</span>
      </form>
    </div>
  );
}
