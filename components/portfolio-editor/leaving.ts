"use client";

import { useRouter } from "next/navigation";
import { keepUnsaved } from "./keep";
import { hasPending } from "./pending";
import { useRuntime, type Going, type Runtime } from "./runtime";

/*
 * Leaving the editor with words it has not sent (decision 0031, "Saving"). useBuilder, the step builder's save hook
 * used as it is, sends the state 0.6s after the last change, when the tab is hidden, and as the editor is taken off
 * the page. e2e/portfolio-leaving.spec.ts found three ways out where words were lost, each with nothing said:
 *
 *  - A link inside the app (a tile, the Add tile, the header, a banner's button). Next fetches the next page first and
 *    takes the editor off the page only once it has come, and a save asked for meanwhile waits in Next's queue behind
 *    that navigation. So the words went only once the next page had come, to that page's address (Next posts an
 *    action to the address it is at, and the server takes it at any of the app's), and a reload or a closed tab while
 *    it was coming lost them. Now they are kept in this browser as the page goes (`pagehide`, below), and otherwise go
 *    as the editor goes, once the next page has come. Nothing is sent at the press: a save sent then is one the
 *    navigation goes ahead of, and Next then asks for the next page a second time (its refresh after a navigation that
 *    went ahead of an action) and shows it only once that second request is answered. That is for words waiting at
 *    the press. A save already on its way then (useBuilder's, sent before it) still makes Next ask twice and wait, as
 *    it did before any of this (measured on 2500a00's editor and on this one). A phone's More, Open goes the same way
 *    (`useGoTo`); it used to load the next page afresh, which dropped a save on its way after asking "Leave site?".
 *  - A full page load (an address typed, a reload, the tab closed). The browser drops a save still on its way, and the
 *    one useBuilder starts as the tab is hidden goes with the page. A server action cannot be sent with keepalive or
 *    as a beacon, so as the page goes (`pagehide`) the newest state, unless the server has said it has it, is kept in
 *    this browser (keep.ts) and the next visit offers it back once, unless the server has it by then (Notices.tsx).
 *  - Newer words waiting behind a save on its way when a link is followed (or typed while the next page is coming).
 *    Next lost the newer save: a navigation that goes ahead of a pending action leaves the end of Next's queue at that
 *    action, and an action added before the navigation is over is never run, so its save never left the browser and
 *    never answered, and back on /portfolio the gate waited for it and said it could not fetch the page. So the press
 *    tells the editor a navigation is under way (`rt.navigating`), and a save asked for until it is over waits for it
 *    and then goes, with the newest words (PortfolioEditor.tsx, startVisit's `underWay`). So the gate waits for every
 *    save however long it takes (one that has left the browser can still land), never for one that will not come, and
 *    never opens on words an older save can still overwrite. Once the editor is off the page what the server has not
 *    said it has is kept in this browser (startVisit's leftBehind).
 *  - A link to this same page (the header's "Your portfolio" on /portfolio) while a save is on its way. Next asks for
 *    the page afresh and goes ahead of that save, so the newer save after it was lost the same way: the status said
 *    Saving, and nothing more was saved until a reload. Such a press holds the saves too, until the page's new data has
 *    come (Next fetches it: a navigation that went ahead of an action is followed by a refresh). With nothing on its
 *    way it holds nothing: a save asked for then runs after Next's navigation and is not lost, and a hold could wait
 *    for new data that never comes (a page Next has kept).
 *
 * Nothing here sends a second save beside useBuilder's: one save at a time, always of the newest state, so an older
 * state never lands after a newer one.
 */

/**
 * Where a press on this link takes the person in this tab: "away", to another page of this site; "again", to this page,
 * which Next fetches afresh (its path with another query, or the very same address). Null for a change of the hash
 * alone (Next fetches nothing then: its navigate-reducer's onlyHashChange), a new tab or window, a download, or another
 * site, which loads that site (`pagehide` sees to it). Either way a save asked for from now until the navigation is
 * over waits for it, and then goes with the newest words (PortfolioEditor.tsx, startVisit's `underWay`); "again" only
 * while a save is on its way. Nothing is sent at the press (above).
 */
function goingTo(a: HTMLAnchorElement, e: MouseEvent): Going | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  const here = new URL(window.location.href);
  const to = new URL(a.href, here);
  if (to.origin !== here.origin) return null;
  if (to.pathname !== here.pathname) return "away";
  return to.hash && to.search === here.search ? null : "again";
}

/**
 * Watches for the person leaving, for the editor's life. A press on a link is heard on the window, once the page's own
 * handlers have had it: React's, at the document, where Next's <Link> takes the press over and starts its navigation in
 * the same breath, so no save can be asked for in between. Only a press Next has taken over (it stops the browser's own
 * navigation: `defaultPrevented`) holds the saves. A link the browser follows itself loads the next page afresh, which
 * `pagehide` sees to, and a hold for it could outlast a "Leave site?" answered Stay (PortfolioEditor.tsx, startVisit's
 * `asked`).
 */
export function watchLeaving(rt: Runtime, owner: string): () => void {
  const onPress = (e: MouseEvent) => {
    if (!e.defaultPrevented) return;
    const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
    const going = a ? goingTo(a, e) : null;
    if (going) rt.navigating(going);
  };
  const onGone = () => {
    if (!hasPending()) return;
    // After the site was updated under this tab the words are kept as that, with its own words on the next visit.
    keepUnsaved(owner, rt.state.get(), rt.save.get().stale ? "stale" : "left");
  };
  window.addEventListener("click", onPress);
  window.addEventListener("pagehide", onGone);
  return () => {
    window.removeEventListener("click", onPress);
    window.removeEventListener("pagehide", onGone);
  };
}

/**
 * Goes to another page of the app from code, as a link does: the page is not loaded afresh, so a save on its way is
 * not dropped and the browser has nothing to warn about, and what is waiting goes as the editor goes.
 */
export function useGoTo(): (href: string) => void {
  const router = useRouter();
  const rt = useRuntime();
  return (href) => {
    rt.navigating("away");
    router.push(href);
  };
}
