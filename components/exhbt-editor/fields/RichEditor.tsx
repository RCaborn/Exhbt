"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Extension, mergeAttributes, type Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import History from "@tiptap/extension-history";
import type { RichSlot } from "@/components/portfolio/page-ctx";
import { safeHref } from "@/lib/exhbt/blocks";
import { docToRuns, runsToDoc, sameRuns, type TiptapNode } from "@/lib/exhbt/richtext-tiptap";
import { useRuntime, type ActiveRich } from "../context";
import { useStore } from "../store";

/*
 * One formatted field's Tiptap editor (RichField.tsx makes it when the field is clicked or focused),
 * in its own chunk. Tiptap's stylesheet is off (`injectCSS: false`): it sets `white-space:
 * break-spaces` and turns ligatures off, which breaks lines in different places from the published
 * paragraph. css/core.css has the two rules the field needs. The marks are drawn as the page draws
 * them (components/exhbt/RichText.tsx): bold as semibold, the context line's bold as the highlight,
 * a link with the page's link classes.
 */

/** One paragraph per field, and Enter doesn't start another. */
const OneParagraph = Document.extend({ content: "paragraph" });
const NoNewParagraphs = Extension.create({
  name: "noNewParagraphs",
  addKeyboardShortcuts: () => ({ Enter: () => true, "Shift-Enter": () => true, "Mod-Enter": () => true }),
});
/** Bold as the page draws it. */
const PageBold = Bold.extend({
  renderHTML: ({ HTMLAttributes }) => ["strong", mergeAttributes(HTMLAttributes, { class: "font-semibold" }), 0],
});
/** The context line's highlight: stored as bold, drawn as the page's mark, so the line being typed is the line that will be published. */
const Highlight = Bold.extend({
  parseHTML: () => [{ tag: "mark" }, { tag: "strong" }, { tag: "b" }],
  renderHTML: ({ HTMLAttributes }) => ["mark", mergeAttributes(HTMLAttributes, { class: "xp-mark" }), 0],
});
const PageLink = Link.configure({
  openOnClick: false,
  autolink: false,
  linkOnPaste: false,
  defaultProtocol: "https",
  HTMLAttributes: { rel: "nofollow ugc noopener", target: null, class: "link text-ink" },
  isAllowedUri: (url) => safeHref(url) !== null,
});

const LINK_ERROR = "Links must start with https://.";

export default function RichEditor({ slot, id, at, onReady, fallback }: { slot: RichSlot; id: string; at: RefObject<{ x: number; y: number } | null>; onReady(): void; fallback: ReactNode }) {
  const store = useStore();
  const rt = useRuntime();
  const path = useRef(slot.path);
  path.current = slot.path;
  const [asking, setAsking] = useState(false);
  const ask = useRef<() => void>(() => {});
  ask.current = () => setAsking(true);

  const editor = useEditor({
    immediatelyRender: false,
    injectCSS: false,
    shouldRerenderOnTransaction: false,
    extensions: [OneParagraph, Paragraph, Text, slot.highlight ? Highlight : PageBold, Italic, History, NoNewParagraphs, PageLink],
    content: runsToDoc(slot.value),
    editorProps: {
      attributes: { id, role: "textbox", "aria-multiline": "true", "aria-label": slot.label, "aria-placeholder": slot.placeholder, class: "xe-pm", spellcheck: "true" },
    },
    onUpdate: ({ editor: e }) => store.setAt(path.current, docToRuns(e.getJSON() as TiptapNode)),
  });

  // The field's name follows its place ("Finding 2" becomes "Finding 1" when the first is removed).
  useEffect(() => {
    editor?.view.dom.setAttribute("aria-label", slot.label);
    editor?.view.dom.setAttribute("id", id);
  }, [editor, slot.label, id]);

  // Changes from outside (an undo, a rewrite) replace the words; typing doesn't.
  useEffect(() => {
    if (editor && !sameRuns(slot.value, docToRuns(editor.getJSON() as TiptapNode))) editor.commands.setContent(runsToDoc(slot.value), { emitUpdate: false });
  }, [editor, slot.value]);

  // Ready: the field is the editor now, with the cursor where the person clicked (or at the end).
  useEffect(() => {
    if (!editor) return;
    onReady();
    const p = at.current;
    const pos = p ? editor.view.posAtCoords({ left: p.x, top: p.y })?.pos : undefined;
    editor.commands.focus(pos ?? "end");
    at.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // The formatted field with the cursor, for the phone's bar (useActiveRich).
  useEffect(() => {
    if (!editor) return;
    let mine: ActiveRich | null = null;
    const publish = () => {
      if (!editor.isFocused) return;
      const flags = { highlight: Boolean(slot.highlight), bold: editor.isActive("bold"), italic: editor.isActive("italic"), link: editor.isActive("link") };
      if (mine && mine.bold === flags.bold && mine.italic === flags.italic && mine.link === flags.link && rt.activeRich.get() === mine) return;
      mine = {
        ...flags,
        toggleBold: () => void editor.chain().focus().toggleBold().run(),
        toggleItalic: () => void editor.chain().focus().toggleItalic().run(),
        toggleLink: () => (editor.isActive("link") ? void editor.chain().focus().extendMarkRange("link").unsetLink().run() : ask.current()),
      };
      rt.activeRich.set(mine);
    };
    const leave = () => rt.activeRich.set((cur) => (cur === mine ? null : cur));
    editor.on("focus", publish);
    editor.on("selectionUpdate", publish);
    editor.on("transaction", publish);
    editor.on("blur", leave);
    if (editor.isFocused) publish();
    return () => {
      editor.off("focus", publish);
      editor.off("selectionUpdate", publish);
      editor.off("transaction", publish);
      editor.off("blur", leave);
      leave();
    };
  }, [editor, rt, slot.highlight]);

  const empty = useEditorState({ editor, selector: ({ editor: e }) => (e ? e.isEmpty : true) });

  if (!editor) return <>{fallback}</>;
  return (
    <>
      <div className="xe-rich-cell">
        {empty && (
          <span aria-hidden className="xe-rich-ph">
            {slot.placeholder}
          </span>
        )}
        <EditorContent editor={editor} className="xe-rich-content" />
      </div>
      {asking && <LinkPrompt editor={editor} onDone={() => setAsking(false)} />}
    </>
  );
}

/** The field's own address prompt, as the classic editor's formatted field asks: an https address, or an error. Out of the flow, under the field. */
function LinkPrompt({ editor, onDone }: { editor: Editor; onDone(): void }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const add = () => {
    const href = safeHref(raw.trim());
    if (!href) return setError(LINK_ERROR);
    const chain = editor.chain().focus();
    if (editor.state.selection.empty) chain.insertContent({ type: "text", text: raw.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    else chain.extendMarkRange("link").setLink({ href }).run();
    onDone();
  };
  return (
    <div className="xe-link-ask" data-edit-only role="group" aria-label="Add a link">
      <label className="xe-link-ask-label">
        Link address (starting https://)
        <input
          ref={input}
          type="url"
          value={raw}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onDone();
              editor.commands.focus();
            }
          }}
        />
      </label>
      <div className="xe-link-ask-actions">
        <button type="button" onClick={add}>
          Add link
        </button>
        <button
          type="button"
          onClick={() => {
            onDone();
            editor.commands.focus();
          }}
        >
          Cancel
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
