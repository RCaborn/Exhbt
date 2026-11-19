"use client";

import { createContext, useContext, useMemo } from "react";
import { fileIdsOf, checkFile, prepareImage, readSize, UploadError, uploadForExhbt } from "@/components/editor/media";
import type { ExhbtDoc, Picked } from "@/lib/exhbt/blocks";
import { formatOf } from "@/lib/exhbt/formats";
import { roomFor } from "@/lib/exhbt/sections";
import { atom, useAtom, type Atom } from "./atom";
import type { Store } from "./store-core";

/*
 * Pictures and the work as a file, for the edit-on-page editor (decision 0026, "The key visual, and
 * pictures by hand"), ported from the classic editor (components/editor/Editor.tsx). The uploads go
 * through components/editor/media.ts, unchanged.
 *
 * No stored file is ever deleted here yet: the rule that decides when one may go (0026, "Saving, and
 * what may delete a file") comes with the editor's second milestone, and keeping a file is always safe.
 */

export type Files = {
  /** A stored file's address for this visit (a signed link, or an object URL for one just uploaded). */
  url(fileId: string): string | null;
  /** Opens the picture picker (several at once) and puts what is chosen on the page from `at`. The input is named "Choose an image". */
  pick(at: number): void;
  /** Uploads pictures and puts them on the page from `at`, in the order they were picked. */
  addImages(files: File[], at: number): Promise<void>;
  replaceImage(sectionId: string, file: File, picked: Picked, opts: { describeAgain: boolean }): Promise<void>;
  attachWork(file: File): Promise<void>;
  removeWork(): void;
  /** Publishing worked: this doc is now the live copy, so files only the old live copy used can go. */
  markPublished(doc: ExhbtDoc): void;
  busy: { image: boolean; work: boolean };
  /** What went wrong with the last upload, in words to show. */
  error: { image?: string; work?: string };
  /** "Uploading 2 of 5", then "3 images added. Each one needs a description for people who can't see it." */
  status: string;
};

type State = {
  imageUrls: Record<string, string | null>;
  busy: Files["busy"];
  error: Files["error"];
  status: string;
};

type Methods = Omit<Files, "busy" | "error" | "status">;

export type FilesController = Methods & {
  state: Atom<State>;
  /** The hidden picture input (EditorShell.tsx draws it). */
  setInput(el: HTMLInputElement | null): void;
  /** The files the live copy uses, for the rule that deletes files. */
  live(): ReadonlySet<string>;
  /** Where the last pick() asked for the pictures to go. */
  pickAt(): number;
};

export function createFiles(opts: { store: Store; exhbtId: string; maxFileMb: number; imageUrls: Record<string, string | null>; liveFileIds: string[] }): FilesController {
  const { store, exhbtId, maxFileMb } = opts;
  const state = atom<State>({ imageUrls: { ...opts.imageUrls }, busy: { image: false, work: false }, error: {}, status: "" });
  let input: HTMLInputElement | null = null;
  let pickAt = 0;
  let live = new Set(opts.liveFileIds);

  const set = (patch: Partial<State> | ((s: State) => Partial<State>)) => state.set((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  const addUrl = (fileId: string, blob: Blob) => set((s) => ({ imageUrls: { ...s.imageUrls, [fileId]: URL.createObjectURL(blob) } }));

  /**
   * Several pictures at once (decision 0024), as many as the layout has room for, two at a time: each
   * is type-checked, shrunk in the browser, size-checked and uploaded, and becomes an image section with
   * its size. They land in the order they were picked, whichever upload finishes first: as each upload
   * settles, the settled run from the front is placed. A failure says which file and why; the rest
   * still go up.
   */
  async function addImages(files: File[], at: number) {
    if (!files.length) return;
    set((s) => ({ error: { ...s.error, image: undefined }, status: "" }));
    const doc = store.get();
    const room = roomFor(doc.sections, "image", formatOf(doc));
    const take = files.slice(0, room);
    const problems: string[] = [];
    if (files.length > take.length) problems.push(room === 0 ? "There's no room for another image in this layout." : `Only ${room} more ${room === 1 ? "fits" : "fit"} in this layout. The rest weren't added.`);
    if (!take.length) {
      set((s) => ({ error: { ...s.error, image: problems.join(" ") } }));
      return;
    }
    // A file that cannot be used is said at once, before anything goes up.
    const early = take.map((f) => checkFile(f, "image", Infinity));
    early.forEach((p, i) => p && problems.push(`${take[i]!.name}: ${p}`));
    if (problems.length) set((s) => ({ error: { ...s.error, image: problems.join("\n") } }));

    set((s) => ({ busy: { ...s.busy, image: true }, status: `Uploading 1 of ${take.length}` }));
    let done = 0;
    let next = 0;
    let placed = 0;
    let placedUpTo = 0;
    const results: ({ fileId: string; w?: number; h?: number } | null)[] = take.map(() => null);
    const settled: boolean[] = take.map(() => false);
    const added: string[] = [];
    const place = () => {
      while (placedUpTo < take.length && settled[placedUpTo]) {
        const r = results[placedUpTo];
        const name = take[placedUpTo]!.name;
        placedUpTo++;
        if (!r) continue;
        const id = store.insertImage(r, at + placed);
        if (id) {
          placed++;
          added.push(id);
        } else problems.push(`${name}: there was no room for it in this layout.`);
      }
    };
    const worker = async () => {
      while (next < take.length) {
        const i = next++;
        const file = take[i]!;
        try {
          if (early[i]) throw new UploadError(early[i]!);
          const prepared = await prepareImage(file);
          const sizeProblem = checkFile(prepared.file, "image", maxFileMb);
          if (sizeProblem) throw new UploadError(sizeProblem);
          const fileId = await uploadForExhbt(prepared.file, "image", exhbtId);
          addUrl(fileId, prepared.file);
          results[i] = { fileId, ...(prepared.w && prepared.h ? { w: prepared.w, h: prepared.h } : {}) };
        } catch (e) {
          if (!early[i]) problems.push(`${file.name}: ${e instanceof UploadError ? e.message : "We couldn't upload that picture."}`);
        } finally {
          settled[i] = true;
          done++;
          place();
          set({ status: done < take.length ? `Uploading ${done + 1} of ${take.length}` : "" });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    set((s) => ({
      busy: { ...s.busy, image: false },
      error: { ...s.error, image: problems.length ? problems.join("\n") : undefined },
      status: placed > 0 ? `${placed === 1 ? "1 image" : `${placed} images`} added. Each one needs a description for people who can't see it.` : "",
    }));
    if (input) input.value = "";
    if (placed > 0) {
      // The cursor goes to the first new picture's description, unless the person has gone somewhere else meanwhile.
      setTimeout(() => {
        const a = document.activeElement;
        if (a && a !== document.body && a !== input && !a.closest("[data-xe-adds]")) return;
        const d = store.get();
        const n = d.sections.filter((s) => s.kind === "image").findIndex((s) => s.kind === "image" && s.id === added[0] && !s.alt.trim());
        if (n >= 0) document.getElementById(`image-${n}-alt`)?.focus();
      }, 120);
    }
  }

  const methods: Methods = {
    url: (fileId) => state.get().imageUrls[fileId] ?? null,
    pick(at) {
      pickAt = at;
      input?.click();
    },
    addImages,
    async replaceImage(sectionId, file, picked, o) {
      const problem = checkFile(file, "image", maxFileMb);
      if (problem) throw new UploadError(problem);
      const fileId = await uploadForExhbt(file, "image", exhbtId);
      const size = await readSize(file);
      addUrl(fileId, file);
      // Not an undo entry (decision 0026): the old picture goes once the save without it lands.
      store.patch(sectionId, (s) => (s.kind === "image" ? { ...s, fileId, picked, ...(size ?? {}), ...(o.describeAgain ? { alt: "", caption: [] } : {}) } : s));
    },
    async attachWork(file) {
      set((s) => ({ error: { ...s.error, work: undefined } }));
      const problem = checkFile(file, "evidence", maxFileMb);
      if (problem) return set((s) => ({ error: { ...s.error, work: problem } }));
      set((s) => ({ busy: { ...s.busy, work: true } }));
      try {
        const fileId = await uploadForExhbt(file, "evidence", exhbtId);
        store.patchDoc((d) => ({ ...d, evidence: { kind: "file", fileId, label: file.name } }));
      } catch (e) {
        set((s) => ({ error: { ...s.error, work: e instanceof UploadError ? e.message : "We couldn't upload that file." } }));
      } finally {
        set((s) => ({ busy: { ...s.busy, work: false } }));
      }
    },
    removeWork() {
      store.patchDoc((d) => {
        if (!d.evidence) return d;
        const next = { ...d };
        delete next.evidence;
        return next;
      }, "remove the work");
    },
    markPublished(doc) {
      live = new Set(fileIdsOf(doc));
    },
  };

  return {
    ...methods,
    state,
    setInput(el) {
      input = el;
    },
    live: () => live,
    pickAt: () => pickAt,
  };
}

export const FilesContext = createContext<FilesController | null>(null);

export function useFilesController(): FilesController {
  const f = useContext(FilesContext);
  if (!f) throw new Error("useFiles needs the editor's FilesContext (components/exhbt-editor/EditorShell.tsx).");
  return f;
}

/** The pictures' addresses for this visit. */
export function useImageUrls(): Record<string, string | null> {
  return useAtom(useFilesController().state, (s) => s.imageUrls);
}

export function useFiles(): Files {
  const f = useFilesController();
  const s = useAtom(f.state);
  return useMemo(() => ({ url: f.url, pick: f.pick, addImages: f.addImages, replaceImage: f.replaceImage, attachWork: f.attachWork, removeWork: f.removeWork, markPublished: f.markPublished, busy: s.busy, error: s.error, status: s.status }), [f, s]);
}
