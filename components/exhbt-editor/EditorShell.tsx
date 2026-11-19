"use client";

import "./css/core.css";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { IMAGE_ACCEPT } from "@/components/editor/media";
import { writeBackup } from "@/components/editor/useAutosave";
import type { PageCtx } from "@/components/portfolio/page-ctx";
import { ProjectView, type Owner } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { formatOf } from "@/lib/exhbt/formats";
import { useAdapter } from "./adapter";
import { Autosave } from "./Autosave";
import { createRuntime, RuntimeContext, useEnv, useRuntime, useUiState, type PageEditorProps, type Runtime } from "./context";
import { createDraftTools, DraftToolsContext } from "./draft-tools";
import { DragBoard } from "./drag";
import { GrowContext } from "./fields/InlineText";
import { createFiles, FilesContext, useFiles, useFilesController, useImageUrls, type FilesController } from "./files";
import { ChartSheet } from "./figures/ChartSheet";
import { DraftedGraph } from "./figures/DraftedGraph";
import { FigureSheet } from "./figures/FigureSheet";
import { PageCtxContext } from "./Frame";
import { CANVAS, LOOK_GROUND } from "./geometry";
import { jumpTo } from "./jump";
import { notePending } from "./pending";
import { PhoneBar } from "./phone/PhoneBar";
import { ReorderSheet } from "./phone/ReorderSheet";
import { CardSheet } from "./sheets/CardSheet";
import { PublishSheet } from "./sheets/PublishSheet";
import { WorkPanel } from "./sheets/WorkPanel";
import { StoreContext, useRenderCount, useShell, useStoreInternal } from "./store";
import { createStore, type Store } from "./store-core";
import { TopBar } from "./topbar/TopBar";
import { Tray } from "./Tray";

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

const devParam = (key: string) => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(key) : null);

type Visit = { store: Store; runtime: Runtime; files: FilesController; draft: ReturnType<typeof createDraftTools> };

function startVisit(props: PageEditorProps): Visit {
  const store = createStore(props.initialDoc, {
    // The browser copy and the newest doc, in the change itself, before anyone is told (decision 0026, "Saving").
    onChange: (doc) => {
      writeBackup(props.id, doc);
      notePending(doc);
    },
  });
  const runtime = createRuntime(props, jumpTo);
  const files = createFiles({ store, exhbtId: props.id, maxFileMb: props.maxFileMb, imageUrls: props.imageUrls, liveFileIds: props.liveFileIds });
  const draft = createDraftTools(store, props.id, props.draftTools);
  return { store, runtime, files, draft };
}

export function PageEditor(props: PageEditorProps) {
  if (devParam("crash") === "render") throw new Error("The new editor was told to fail (?crash=render, development only).");
  const [visit] = useState(() => startVisit(props));
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
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
  return (
    <div {...lookAttrs(theme)} style={themeStyle(theme)} className={LOOK_GROUND}>
      {visitor ? (
        <section aria-label="Preview" className={CANVAS}>
          <Visitor />
        </section>
      ) : (
        <DragBoard>
          <div className={CANVAS}>
            <Canvas />
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
  return (
    <PageCtxContext value={ctx}>
      <ProjectView doc={shell} owner={owner} imageUrls={imageUrls} headingLevel="h2" confirmed={confirmed} edit={adapter} />
    </PageCtxContext>
  );
}

/** "See as a visitor": the same doc with no adapter (decision 0026). */
function Visitor() {
  const store = useStoreInternal();
  const doc = useSyncExternalStore(store.subscribe, store.get, store.get);
  const imageUrls = useImageUrls();
  const confirmed = useUiState((s) => s.confirmed);
  const owner = useOwner();
  const env = useEnv();
  const evidenceUrl = doc.evidence?.kind === "link" ? doc.evidence.href : doc.evidence?.kind === "file" ? env.fileEvidenceUrl : null;
  return <ProjectView doc={doc} owner={owner} imageUrls={imageUrls} evidenceUrl={evidenceUrl} headingLevel="h2" confirmed={confirmed} />;
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
      <p role="alert" className="xe-status-error">
        {error}
      </p>
    </div>
  );
}

/** The one polite live region: moves, adds and removes are said here. */
function LiveRegion() {
  const said = useUiState((s) => s.said);
  return (
    <div aria-live="polite" className="sr-only" data-said={said.n}>
      {said.text}
    </div>
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
      const label = store.undoLabel();
      if (!label) return;
      e.preventDefault();
      store.undo();
      uiApi.say(`Undone: ${label}.`);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [store, uiApi]);
  return null;
}

/** Development only (`?crash=change`): throws on the render after the first change, for the crash fallback's test. */
function CrashOnChange(): ReactNode {
  const store = useStoreInternal();
  const changes = useSyncExternalStore(store.subscribe, store.version, store.version);
  if (changes > 0) throw new Error("The new editor was told to fail after a change (?crash=change, development only).");
  return null;
}
