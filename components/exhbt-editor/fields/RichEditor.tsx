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
import { Bold as BoldIcon, Highlighter, Italic as ItalicIcon, Link2, Unlink } from "lucide-react";
import type { RichSlot } from "@/components/portfolio/page-ctx";
import { safeHref } from "@/lib/exhbt/blocks";
import { docToRuns, runsToDoc, sameRuns, type TiptapNode } from "@/lib/exhbt/richtext-tiptap";
import { useRuntime, type ActiveRich } from "../context";
import { useStore } from "../store";
import { issueId } from "./issues";

/*
 * One formatted field's Tiptap editor (RichField.tsx makes it), in its own chunk. Tiptap's stylesheet
 * is off (`injectCSS: false`): it sets `white-space: break-spaces` and turns ligatures off, which
 * breaks lines in different places from the published paragraph; css/core.css has the two rules the
 * field needs. The marks are drawn as the page draws them (components/exhbt/RichText.tsx): bold as
 * semibold, the context line's bold as the highlight, a link with the page's link classes.
 *
 * While it has the cursor its formatting buttons (Highlight on the context line; bold, italic and link
 * elsewhere) float above the line's right end, out of the flow; on a section's first line, where the
 * section's toolbar sits, they go below the line instead, so the two never overlap.
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

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type Props = { slot: RichSlot; id: string; at: RefObject<{ x: number; y: number } | null>; focusOnReady: boolean; issue: string; onReady(): void; fallback: ReactNode };

export default function RichEditor({ slot, id, at, focusOnReady, issue, onReady, fallback }: Props) {
  const store = useStore();
  const rt = useRuntime();
  const path = useRef(slot.path);
  path.current = slot.path;
  const wantsFocus = useRef(focusOnReady);
  wantsFocus.current = focusOnReady;
  const [asking, setAsking] = useState(false);
  const [below, setBelow] = useState(false);
  const cell = useRef<HTMLDivElement>(null);

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
    onFocus: () => setBelow(onFirstLine(cell.current)),
  });

  // The field's name and its issue follow its place ("Finding 2" becomes "Finding 1" when the first is removed).
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    dom.setAttribute("aria-label", slot.label);
    dom.setAttribute("id", id);
    if (issue) {
      dom.setAttribute("aria-invalid", "true");
      dom.setAttribute("aria-describedby", issueId(id));
    } else {
      dom.removeAttribute("aria-invalid");
      dom.removeAttribute("aria-describedby");
    }
  }, [editor, slot.label, id, issue]);

  // Changes from outside (an undo, a rewrite) replace the words; typing doesn't.
  useEffect(() => {
    if (editor && !sameRuns(slot.value, docToRuns(editor.getJSON() as TiptapNode))) editor.commands.setContent(runsToDoc(slot.value), { emitUpdate: false });
  }, [editor, slot.value]);

  // Ready: the field is the editor now. Started by the person, it takes the cursor where they clicked (or at the end).
  useEffect(() => {
    if (!editor) return;
    onReady();
    if (wantsFocus.current || document.activeElement === editor.view.dom.closest(".xe-rich")) {
      const p = at.current;
      const pos = p ? editor.view.posAtCoords({ left: p.x, top: p.y })?.pos : undefined;
      editor.commands.focus(pos ?? "end");
    }
    at.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // The formatted field with the cursor, for the phone's bar (useActiveRich).
  const ask = useRef<() => void>(() => {});
  ask.current = () => setAsking(true);
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

  // Draws again when emptiness or a mark under the cursor changes; the flags are read from the editor itself, which is never stale.
  useEditorState({ editor, selector: ({ editor: e }) => (e ? `${e.isEmpty ? 1 : 0}${e.isActive("bold") ? 1 : 0}${e.isActive("italic") ? 1 : 0}${e.isActive("link") ? 1 : 0}` : "") });
  const empty = editor ? editor.isEmpty : true;
  const bold = editor?.isActive("bold") ?? false;
  const italic = editor?.isActive("italic") ?? false;
  const link = editor?.isActive("link") ?? false;

  if (!editor) return <>{fallback}</>;
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const linkClick = () => (link ? editor.chain().focus().extendMarkRange("link").unsetLink().run() : setAsking(true));
  return (
    <>
      <div ref={cell} className="xe-rich-cell">
        {empty && (
          <span aria-hidden className="xe-rich-ph">
            {slot.placeholder}
          </span>
        )}
        <EditorContent editor={editor} className="xe-rich-content" />
      </div>
      <div role="toolbar" aria-label="Formatting" className={cx("xe-format", below && "xe-format-below")} data-edit-only onMouseDown={keep}>
        {slot.highlight ? (
          <button type="button" className="xe-chip" aria-pressed={bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Highlighter aria-hidden size={14} strokeWidth={2.5} /> Highlight
          </button>
        ) : (
          <>
            <button type="button" className="xe-tool xe-tool-sm" aria-label="Bold" data-tip="Bold" aria-pressed={bold} onClick={() => editor.chain().focus().toggleBold().run()}>
              <BoldIcon aria-hidden size={14} strokeWidth={2.5} />
            </button>
            <button type="button" className="xe-tool xe-tool-sm" aria-label="Italic" data-tip="Italic" aria-pressed={italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <ItalicIcon aria-hidden size={14} strokeWidth={2.5} />
            </button>
          </>
        )}
        <button type="button" className="xe-tool xe-tool-sm" aria-label={link ? "Remove link" : "Link"} data-tip={link ? "Remove link" : "Link"} onClick={linkClick}>
          {link ? <Unlink aria-hidden size={14} strokeWidth={2.5} /> : <Link2 aria-hidden size={14} strokeWidth={2.5} />}
        </button>
      </div>
      {asking && <LinkPrompt editor={editor} onDone={() => setAsking(false)} />}
    </>
  );
}

/** Whether the field starts on its section's first line, where the section's toolbar sits (or under a shell part's corner toolbar). */
function onFirstLine(cell: HTMLElement | null): boolean {
  const field = cell?.closest(".xe-rich");
  if (!field) return false;
  if (field.parentElement?.querySelector(":scope > .xe-shell-tools")) return true;
  const frame = field.closest(".xe-frame");
  if (!frame) return false;
  return field.getBoundingClientRect().top - frame.getBoundingClientRect().top < 48;
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
  const cancel = () => {
    onDone();
    editor.commands.focus();
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
              cancel();
            }
          }}
        />
      </label>
      <div className="xe-link-ask-actions">
        <button type="button" onClick={add}>
          Add link
        </button>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
