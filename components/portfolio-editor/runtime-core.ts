import { issuesOf } from "@/app/(app)/portfolio/builder-state";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import { atom } from "@/components/exhbt-editor/atom";
import type { HomePath } from "@/components/portfolio/home-ctx";
import { themeById } from "@/lib/portfolio-themes";
import { LINK_PATHS, setAtPath } from "./paths";
import { notePending } from "./pending";
import type { LineDraft, PortfolioEditorApi, PortfolioSheet, PortfolioUi, Runtime, SaveView, UndoView } from "./runtime";
import { applyUndo, entryFor, subjectOf, UNDO_LIMIT, type UndoEntry } from "./undo";

/*
 * The portfolio editor's runtime, made once for a visit (decision 0031): the atoms the page reads and
 * the actions it calls. No React in it. The state's one writer is `change`, which hands the change to
 * `useBuilder` (the step builder's save hook, used as it is: it keeps the newest state, sends it shortly
 * after and owns the save status) and puts the same state in the atom in the same breath, so the page
 * shows a key before the browser paints it and the atom never differs from what will be saved.
 */

/** What the runtime needs of `useBuilder`, read each time: PortfolioEditor.tsx fills it in as it renders. */
export type Host = {
  /** useBuilder's `change`: applies `update` to its newest state, at once, and schedules the save. */
  change(update: (s: BuilderState) => BuilderState): void;
  /** Sends what is waiting now. */
  retry(): void;
};

/** A field or anything else that takes the keyboard. */
const FIELDS = 'textarea, input:not([type=hidden]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';
const PRESSABLE = "button, a[href], [tabindex]";

/** The editor's root on the page. */
const root = () => document.querySelector<HTMLElement>('[data-editor="portfolio"]');

const sameIssues = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};

export function createRuntime(initial: BuilderState, host: Host): Runtime {
  const state = atom(initial);
  const ui = atom<PortfolioUi>({ sheet: null, previewing: null, issues: issuesOf(initial), visitor: false, full: false, marked: null, team: null });
  const save = atom<SaveView>({ status: { kind: "saved" }, stale: false });
  const undo = atom<UndoView>({ label: null });
  const said = atom({ text: "", n: 0 });
  const lines = atom<Record<HomePath, LineDraft>>({});

  /** What had the focus when a sheet was opened: where it goes back to. */
  let opener: HTMLElement | null = null;
  /** What Undo can take back, oldest first. It lasts for the visit. */
  const stack: UndoEntry[] = [];

  const say = (message: string) => said.set((s) => ({ text: message, n: s.n + 1 }));

  /** Applies a change through useBuilder and puts the same state in the atom. `label` makes it a step Undo can take back. */
  function change(update: (s: BuilderState) => BuilderState, label?: string): void {
    const seen: { before?: BuilderState; after?: BuilderState } = {};
    host.change((s) => {
      seen.before = s;
      seen.after = update(s);
      // Noted for the crash fallback before any part of the page is told (pending.ts).
      if (seen.after !== s) notePending(seen.after);
      return seen.after;
    });
    const { before, after } = seen;
    if (!before || !after || after === before) return;
    if (label) {
      // Only the keys this change touched, so typing done since is never lost to an Undo (undo.ts).
      const entry = entryFor(label, before, after);
      if (entry) {
        stack.push(entry);
        if (stack.length > UNDO_LIMIT) stack.shift();
        undo.set({ label: entry.label });
      }
    }
    state.set(after);
    const issues = issuesOf(after);
    ui.set((u) => (sameIssues(u.issues, issues) ? u : { ...u, issues }));
  }

  /** Takes back the newest step, says so, and puts the focus somewhere sensible. */
  function undoLast(): void {
    const entry = stack.pop();
    if (!entry) return;
    const before = state.get();
    change((s) => applyUndo(s, entry));
    undo.set({ label: stack[stack.length - 1]?.label ?? null });
    say(`Undone: ${entry.label}.`);
    const subject = subjectOf(entry, before, state.get());
    requestAnimationFrame(() => {
      // To the section it brought back or moved: its first field, or under a finger its first button, so a
      // phone's keyboard does not open on its own. With none, the focus stays where it is unless what had it
      // has gone: then Undo keeps it while it can still be pressed, and the bar's heading takes it otherwise.
      const section = subject ? root()?.querySelector<HTMLElement>(`[data-section="${CSS.escape(subject)}"]`) : null;
      const finger = window.matchMedia("(pointer: coarse)").matches;
      const target = (finger ? null : section?.querySelector<HTMLElement>(FIELDS)) ?? section?.querySelector<HTMLElement>("button");
      if (target) return target.focus();
      const a = document.activeElement;
      if (a && a !== document.body && a.isConnected) return;
      document.getElementById(stack.length ? "pe-undo" : "pe-heading")?.focus();
    });
  }

  function open(sheet: PortfolioSheet): void {
    if (ui.get().sheet === sheet) return;
    const a = document.activeElement;
    if (!ui.get().sheet) opener = a instanceof HTMLElement && a !== document.body ? a : null;
    ui.set((u) => ({ ...u, sheet }));
  }

  function close(): void {
    if (!ui.get().sheet) return;
    ui.set((u) => ({ ...u, sheet: null }));
    const back = opener;
    opener = null;
    // A sheet gives the focus back itself (it is a dialog). This is for what is not one: a menu or a popover
    // that leaves the focus on the page's body when it goes.
    requestAnimationFrame(() => {
      const a = document.activeElement;
      if (back?.isConnected && !ui.get().sheet && (!a || a === document.body)) back.focus();
    });
  }

  function jumpTo(path: HomePath): void {
    // The field is on the editing page, not the visitor's; and the links are in their popover.
    if (ui.get().visitor) ui.set((u) => ({ ...u, visitor: false }));
    if (LINK_PATHS.includes(path)) open("links");
    let tries = 0;
    const go = () => {
      const page = root();
      // A line's own path first; failing that, its list (where the list's own problem is shown).
      const el = page?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`) ?? (/\.\d+$/.test(path) ? page?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path.replace(/\.\d+$/, ""))}"]`) : null);
      if (!el) {
        // What it lives in may still be opening.
        if (++tries < 30) requestAnimationFrame(go);
        return;
      }
      const target = el.matches(FIELDS) ? el : (el.querySelector<HTMLElement>(FIELDS) ?? el.querySelector<HTMLElement>(PRESSABLE) ?? el);
      if (target === el && !el.matches(`${FIELDS}, ${PRESSABLE}`)) el.tabIndex = -1;
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      (target.closest<HTMLElement>("[data-para-box]") ?? target).scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
      target.focus({ preventScroll: true });
    };
    requestAnimationFrame(go);
  }

  const api: PortfolioEditorApi = {
    change,
    setAt: (path, value) => change((s) => setAtPath(s, path, value)),
    open,
    close,
    say,
    jumpTo,
    previewLook: (themeId) => ui.set((u) => ({ ...u, previewing: themeId && themeById(themeId) ? themeId : null })),
    seeAsVisitor: (on) => {
      if (ui.get().visitor === on) return;
      ui.set((u) => ({ ...u, visitor: on }));
      say(on ? "This is your portfolio as a visitor sees it." : "Back to editing your portfolio.");
    },
  };

  return { state, ui, save, undo, said, lines, api, undoLast, retry: () => host.retry() };
}
