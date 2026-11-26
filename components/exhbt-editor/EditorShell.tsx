"use client";

import "./css/core.css";
import "./css/your-way.css";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { MadeWith } from "@/components/brand/MadeWith";
import { IMAGE_ACCEPT } from "@/components/editor/media";
import { writeBackup } from "@/components/editor/useAutosave";
import { safeHref } from "@/lib/exhbt/blocks";
import { MARKETING_HOST } from "@/lib/hosts";
import { drawnFlow, keptItems, pageItems } from "@/lib/exhbt/layouts";
import type { PageCtx } from "@/components/portfolio/page-ctx";
import { ProjectView, type Owner } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { formatOf } from "@/lib/exhbt/formats";
import { useAdapter } from "./adapter";
import { Autosave } from "./Autosave";
import { BackupOffer } from "./BackupOffer";
import { createRuntime, RuntimeContext, useEnv, useLive, useRuntime, useUiState, type PageEditorProps, type Runtime, type UiApi } from "./context";
import { createDraftTools, DraftToolsContext } from "./draft-tools";
import { DragBoard } from "./drag";
import { GrowContext } from "./fields/InlineText";
import { closeEditorQueue, openEditorQueue } from "./fields/idle";
import { preloadRichEditor } from "./fields/RichField";
import { labelOf } from "./labels";
import { createFiles, FilesContext, useFiles, useFilesController, useImageUrls, type FilesController } from "./files";
import { ChartSheet } from "./figures/ChartSheet";
import { DraftedGraph } from "./figures/DraftedGraph";
import { FigureSheet } from "./figures/FigureSheet";
import { PageCtxContext } from "./Frame";
import { CANVAS, LOOK_GROUND } from "./geometry";
import { jumpTo } from "./jump";
import { notePending } from "./pending";
import { useNoZoomOnFocus } from "./phone/noZoom";
import { PhoneBar } from "./phone/PhoneBar";
import { ReorderSheet } from "./phone/ReorderSheet";
import { CardSheet } from "./sheets/CardSheet";
import { PublishSheet } from "./sheets/PublishSheet";
import { WorkPanel } from "./sheets/WorkPanel";
import { StoreContext, useDoc, useRenderCount, useShell, useStoreInternal } from "./store";
import { createStore, type Store } from "./store-core";
import { TopBar } from "./topbar/TopBar";
import { HEADING_ID } from "./topbar/UndoButton";
import { Tray } from "./Tray";
import { Said } from "./ui/Said";
import { onPortfolioHost, visitorParts } from "./visitor-parts";

/*
 * The edit-on-page editor (decision 0026): the exhbt page itself, in the person's own look, with every
 * word typed where it sits. Loaded only in the browser, inside the gate's error boundary
 * (EditorGate.tsx), so a throw here reloads the page into the classic editor.
 *
 * What re-renders: the canvas (the shell) reads only the doc as the shell last changed (store-core.ts),
 * and each page item is a memoised frame that reads its own section (Frame.tsx). Everything that reads
 * the whole doc (autosave, the issues, the word count) is a leaf beside the canvas, never above it.
 *
 * Development only: `?crash=render` throws whenever it draws, `?crash=change` on the render after the
 * first change (e2e/editor-classic.spec.ts); `?grow=mirror` makes the plain fields grow by their mirror.
 */

declare global {
  interface Window {
    /** Development only: the editor's store, for e2e/page-editor.ts. */
    __exhbtEditor?: Store;
    /** Development only: the view's actions (open a sheet, see as a visitor, jump), for e2e/page-editor.ts. */
    __exhbtUi?: UiApi;
  }
}

const devParam =(key: string) => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(key) : null);

type Visit = { store: Store; runtime: Runtime; files: FilesController; draft: ReturnType<typeof createDraftTools> };

function startVisit(props: PageEditorProps): Visit {
  const store = createStore(props.initialDoc, {
    // The browser copy and the newest doc, in the change itself, before anyone is told (decision 0026, "Saving").
    onChange: (doc) => {
      writeBackup(props.id, doc);
      notePending(doc, props.id);
    },
  });
  const runtime = createRuntime(props, (path, ui) => jumpTo(path, ui, store.get()));
  const files = createFiles({ store, exhbtId: props.id, maxFileMb: props.maxFileMb, imageUrls: props.imageUrls, liveFileIds: props.liveFileIds, initialDoc: props.initialDoc });
  const draft = createDraftTools(store, props.id, props.draftTools);
  return { store, runtime, files, draft };
}

export function PageEditor(props: PageEditorProps) {
  if (devParam("crash") === "render") throw new Error("The new editor was told to fail (?crash=render, development only).");
  const [visit] = useState(() => startVisit(props));
  const [ready, setReady] = useState(false);
  // An iPhone zooms in on a field under 16px, and the page's own type is mostly under it (phone/noZoom.ts).
  useNoZoomOnFocus();
  useEffect(() => {
    setReady(true);
    // Their chunk is fetched now, so a field clicked first only has to make its editor.
    preloadRichEditor();
    // The formatted fields' editors start, one at a time, in idle moments from now.
    openEditorQueue();
    // Development only: the browser tests read the editor's doc and its undo list (e2e/page-editor.ts).
    if (process.env.NODE_ENV !== "production") {
      window.__exhbtEditor = visit.store;
      window.__exhbtUi = visit.runtime.uiApi;
    }
    // The rule that deletes files runs when the page goes for good, and when the editor unmounts; never when it is only hidden.
    const gone = (e: PageTransitionEvent) => {
      if (!e.persisted) visit.files.settle({ keepalive: true, ending: true });
    };
    window.addEventListener("pagehide", gone);
    return () => {
      window.removeEventListener("pagehide", gone);
      closeEditorQueue();
      visit.files.settle({ keepalive: true, ending: true });
    };
  }, [visit]);
  const grow = devParam("grow") === "mirror" ? "mirror" : null;

  return (
    <StoreContext value={visit.store}>
      <RuntimeContext value={visit.runtime}>
        <FilesContext value={visit.files}>
          <DraftToolsContext value={visit.draft}>
            <GrowContext value={grow}>
              <div
                data-editor="page"
                data-ready={ready ? "true" : undefined}
                className="xe-editor"
                // Focus leaving the editor saves at once.
                onBlur={(e) => {
                  const to = e.relatedTarget as Node | null;
                  if (!to || !e.currentTarget.contains(to)) void visit.runtime.save.get().flush();
                }}
              >
                <TopBar />
                <BackupOffer />
                <Body />
                <PublishSheet />
                <CardSheet />
                <WorkPanel />
                <ChartSheet />
                <FigureSheet />
                <ReorderSheet />
                <PhoneBar />
                <StatusLine />
                <LiveRegion />
                <ImagePicker />
                <UndoKeys />
                <Autosave />
                {devParam("crash") === "change" && <CrashOnChange />}
              </div>
            </GrowContext>
          </DraftToolsContext>
        </FilesContext>
      </RuntimeContext>
    </StoreContext>
  );
}

/** The page in the person's look, at the public frame's width: the editing canvas, or "See as a visitor". */
function Body() {
  const visitor = useUiState((s) => s.visitor);
  const { theme } = useEnv();
  const store = useStoreInternal();
  const files = useFilesController();
  // Pictures dropped onto the page (decision 0026, "Pictures by hand") go in after the section they were dropped on, in the order given.
  const pictures = (e: React.DragEvent) => [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
  const allowPictures = (e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
  };
  const dropPictures = (e: React.DragEvent) => {
    const list = pictures(e);
    if (!list.length) return;
    e.preventDefault();
    const id = (e.target as Element).closest?.("[data-section-id]")?.getAttribute("data-section-id");
    const items = pageItems(store.get());
    const i = items.findIndex((it) => it.id === id);
    void files.addImages(list, i >= 0 ? i + 1 : items.length);
  };
  return (
    <div {...lookAttrs(theme)} style={themeStyle(theme)} className={LOOK_GROUND}>
      {visitor ? (
        <section aria-label="Preview" className={CANVAS}>
          <Visitor />
        </section>
      ) : (
        <DragBoard>
          <div className={CANVAS} onDragOver={allowPictures} onDrop={dropPictures}>
            <Canvas />
            <KeptList />
          </div>
          <DraftedGraph />
          <Tray />
        </DragBoard>
      )}
    </div>
  );
}

/** The owner as the visitor's page has it: the look's photo shape and "All of <name>'s work", drawn but not opened. */
function useOwner(): Owner {
  const env = useEnv();
  return useMemo(() => ({ ...env.owner, shape: env.theme.photo, homeHref: env.liveBase ?? "/portfolio" }), [env]);
}

/** The editing page: ProjectView with the adapter, drawn again only when the shell changes. */
function Canvas() {
  const shell = useShell();
  useRenderCount("shell");
  const adapter = useAdapter();
  const imageUrls = useImageUrls();
  const confirmed = useUiState((s) => s.confirmed);
  const owner = useOwner();
  const format = formatOf(shell);
  const ctx = useMemo<PageCtx>(() => ({ Sub: "h3", imageUrls, format, edit: adapter }), [imageUrls, format, adapter]);
  // Save as PDF, the checked-on line and the team byline, as "See as a visitor" draws them, inert: the page is the visitor's box for box.
  const env = useEnv();
  const { publishedAt } = useLive();
  const parts = useMemo(() => visitorParts(env, publishedAt), [env, publishedAt]);
  return (
    <PageCtxContext value={ctx}>
      <ProjectView doc={shell} owner={owner} imageUrls={imageUrls} headingLevel="h2" confirmed={confirmed} edit={adapter} {...parts} />
    </PageCtxContext>
  );
}

/** "See as a visitor": the same doc with no adapter (decision 0026). */
function Visitor() {
  const store = useStoreInternal();
  const stored = useSyncExternalStore(store.subscribe, store.get, store.get);
  // Blank flowchart boxes stay out of the visitor's page (the editing page shows every box).
  const doc = useMemo(() => ({ ...stored, flow: drawnFlow(stored.flow) }), [stored]);
  const imageUrls = useImageUrls();
  const confirmed = useUiState((s) => s.confirmed);
  const owner = useOwner();
  const env = useEnv();
  // A link is drawn only if it is https, as on the public page (lib/portfolio.ts mediaFor).
  const evidenceUrl = doc.evidence?.kind === "link" ? safeHref(doc.evidence.href) : doc.evidence?.kind === "file" ? env.fileEvidenceUrl : null;
  // Save as PDF, the date beside the checks (the publish date, or today's for a draft), the checks link and the team byline, as the public page draws them.
  const { publishedAt } = useLive();
  const parts = useMemo(() => visitorParts(env, publishedAt), [env, publishedAt]);
  return (
    <>
      <ProjectView doc={doc} owner={owner} imageUrls={imageUrls} evidenceUrl={evidenceUrl} headingLevel="h2" confirmed={confirmed} {...parts} />
      <div data-visitor-signoff>
        <MadeWith startHref={onPortfolioHost(env) ? `https://${MARKETING_HOST}/start` : "/start"} />
      </div>
    </>
  );
}

/** A small line fixed at the foot of the window, out of the flow: the upload's progress, and under it what went wrong. On a phone L's bar lifts it (css/phone.css). */
function StatusLine() {
  const files = useFiles();
  const error = [files.error.image, files.error.work].filter(Boolean).join("\n");
  return (
    <div className="xe-status" data-edit-only>
      <p role="status" className="xe-status-line">
        {files.status}
      </p>
      {error && (
        <p role="alert" className="xe-status-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** The one polite live region: moves, adds and removes are said here. */
function LiveRegion() {
  const said = useUiState((s) => s.said);
  return (
    <Said text={said.text} n={said.n} data-said={said.n} />
  );
}

/** The picture picker: several at once, put on the page from where it was asked for. */
function ImagePicker() {
  const files = useFilesController();
  return <input ref={(el) => files.setInput(el)} type="file" hidden tabIndex={-1} aria-label="Choose an image" accept={IMAGE_ACCEPT} multiple onChange={(e) => void files.addImages(Array.from(e.target.files ?? []), files.pickAt())} />;
}

const inField = (el: Element | null) => Boolean(el?.closest('textarea, input, select, [contenteditable]:not([contenteditable="false"])'));

/** Ctrl or Cmd and Z undoes the last structural action, only when the cursor is not in a text field (decision 0026). */
function UndoKeys(): ReactNode {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
      if (inField(document.activeElement)) return;
      if (!store.undoLabel()) return;
      e.preventDefault();
      uiApi.say(store.undo().words);
    };
    document.addEventListener("keydown", onKey);
    // After an Undo (from here or from the top bar's Undo, which leaves the focus to this), the focus goes to what
    // it brought back or moved: the first field of a section, or a flowchart box's words (the flowchart itself when
    // the undo took that box out). With none, it stays where it is (on Undo) while Undo can still be pressed, and
    // otherwise goes to the top bar's heading (decision 0026). The page is drawn first and the focus moves in the
    // same frame as the Undo: a frame later it could take the focus from wherever the person had gone since.
    const off = store.onUndone((subject, box) => {
      flushSync(() => {});
      const target = undoneTarget(subject, box);
      if (target) target.focus();
      else if (store.undoLabel()) {
        // The focus was in what the undo took out: Undo keeps it.
        if (!document.activeElement || document.activeElement === document.body) document.getElementById("xe-undo")?.focus();
      } else document.getElementById(HEADING_ID)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      off();
    };
  }, [store, uiApi]);
  return null;
}

const FIELDS = 'textarea, input:not([type=file]):not([type=hidden]), [contenteditable]:not([contenteditable="false"]), [role=textbox]';

/**
 * Where the focus goes after an undo: a box's words (or the flowchart, the box gone), else the section's first field,
 * its grip, or the frame itself. Under a finger the grip (the box's or the section's) comes before the words, so a
 * phone's or a tablet's keyboard does not open on its own.
 */
function undoneTarget(subject: string | null, box: string | null): HTMLElement | null {
  const page = document.querySelector<HTMLElement>('[data-editor="page"]');
  if (!page || !subject) return null;
  const finger = window.matchMedia("(pointer: coarse)").matches;
  if (box !== null) {
    const step = page.querySelector<HTMLElement>(`[data-flow-step="${CSS.escape(box)}"]`);
    return (finger ? step?.querySelector<HTMLElement>("[data-flow-grip]") : null) ?? step?.querySelector<HTMLElement>('[data-path$=".step"]') ?? page.querySelector<HTMLElement>('[data-path="flow"]');
  }
  const frame = page.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(subject)}"]`);
  if (!frame) return null;
  const grip = frame.querySelector<HTMLElement>("[data-grip]");
  const inner = (finger ? grip : null) ?? frame.querySelector<HTMLElement>(FIELDS) ?? grip;
  if (inner) return inner;
  if (!frame.hasAttribute("tabindex")) frame.tabIndex = -1;
  return frame;
}

/** Sections the layout keeps but does not draw (decision 0027): a list at the foot of the page, each with Remove. Not on the visitor's page. */
function KeptList() {
  const store = useStoreInternal();
  const key = useDoc((d) => keptItems(d).map((it) => `${it.id}\u0000${labelOf(d, it.id)}`).join("\u0001"));
  if (!key) return null;
  const kept = key.split("\u0001").map((row) => row.split("\u0000") as [string, string]);
  return (
    <section aria-labelledby="xe-kept-h" className="xe-kept" data-edit-only>
      <h2 id="xe-kept-h" className="xe-kept-heading">
        Kept, not shown in this layout
      </h2>
      <ul>
        {kept.map(([id, label]) => (
          <li key={id}>
            <span>{label}</span>
            <button type="button" className="xe-chip" aria-label={`Remove ${label}`} onClick={() => store.remove(id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Development only (`?crash=change`): throws on the render after the first change, for the crash fallback's test. */
function CrashOnChange(): ReactNode {
  const store = useStoreInternal();
  const changes = useSyncExternalStore(store.subscribe, store.version, store.version);
  if (changes > 0) throw new Error("The new editor was told to fail after a change (?crash=change, development only).");
  return null;
}
