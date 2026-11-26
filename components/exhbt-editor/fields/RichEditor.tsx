"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * `live`: the resting field has handed over to this editor (RichField.tsx). Until then the editor is drawn
 * out of the flow, unseen and inert, while the resting field still takes the typing. `onReady` starts the
 * hand-over once the editor exists; `name` gives the editor its id, role and name once it is live.
 */
type Props = { slot: RichSlot; id: string; issue: string; live: boolean; onReady(editor: Editor, name: () => void): void };

export default function RichEditor({ slot, id, issue, live, onReady }: Props) {
  const store = useStore();
  const rt = useRuntime();
  const path = useRef(slot.path);
  path.current = slot.path;
  const [asking, setAsking] = useState(false);
  const [below, setBelow] = useState(false);
  const [aside, setAside] = useState(0);
  const cell = useRef<HTMLDivElement>(null);
  // Tiptap compares its options on every render and hands the editor new ones when any differ, which
  // updates the whole view. The words and the attributes it starts with are kept from the first render,
  // so a render for anything else (the section moved, so the path changed) costs the editor nothing;
  // the effects below write what changes.
  const [start] = useState(() => ({
    content: runsToDoc(slot.value),
    // The id, the role and the name come when it is live (`name` below): until then the resting field has them.
    editorProps: { attributes: { "aria-multiline": "true", class: "xe-pm", spellcheck: "true" } },
  }));

  const editor = useEditor({
    immediatelyRender: false,
    injectCSS: false,
    shouldRerenderOnTransaction: false,
    extensions: [OneParagraph, Paragraph, Text, slot.highlight ? Highlight : PageBold, Italic, History, NoNewParagraphs, PageLink],
    content: start.content,
    editorProps: start.editorProps,
    onUpdate: ({ editor: e }) => store.setAt(path.current, docToRuns(e.getJSON() as TiptapNode)),
    onFocus: () => {
      const under = onFirstLine(cell.current);
      setBelow(under);
      setAside(clearOfToolbars(cell.current, under));
    },
  });

  // The field's name, its placeholder and its issue follow its place ("Finding 2" becomes "Finding 1" when the first is removed).
  const liveNow = useRef(live);
  liveNow.current = live;
  const name = () => {
    const dom = editor?.view.dom;
    if (!dom || !liveNow.current) return;
    dom.setAttribute("role", "textbox");
    dom.setAttribute("aria-label", slot.label);
    dom.setAttribute("aria-placeholder", slot.placeholder);
    dom.setAttribute("id", id);
    if (issue) {
      dom.setAttribute("aria-invalid", "true");
      dom.setAttribute("aria-describedby", issueId(id));
    } else {
      dom.removeAttribute("aria-invalid");
      dom.removeAttribute("aria-describedby");
    }
  };
  const nameNow = useRef(name);
  nameNow.current = name;
  useEffect(name, [editor, live, slot.label, slot.placeholder, id, issue]);

  // Changes from outside (an undo, a rewrite) replace the words; typing doesn't.
  useEffect(() => {
    if (editor && !sameRuns(slot.value, docToRuns(editor.getJSON() as TiptapNode))) editor.commands.setContent(runsToDoc(slot.value), { emitUpdate: false });
  }, [editor, slot.value]);

  // Made: the resting field hands over its words, and its cursor if it has it (RichField.tsx).
  useEffect(() => {
    if (editor) onReady(editor, () => nameNow.current());
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

  if (!editor) return null;
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const linkClick = () => (link ? editor.chain().focus().extendMarkRange("link").unsetLink().run() : setAsking(true));
  const content = (
    <div ref={cell} className={cx("xe-rich-cell", !live && "xe-rich-pending")} inert={!live || undefined} aria-hidden={!live || undefined}>
      {empty && (
        <span aria-hidden className="xe-rich-ph">
          {slot.placeholder}
        </span>
      )}
      <EditorContent editor={editor} className="xe-rich-content" />
    </div>
  );
  // Not yet live: no buttons (the resting field has the focus, and they would act on words it has not handed over).
  if (!live) return <>{content}</>;
  return (
    <>
      {content}
      <div
        role="toolbar"
        aria-label="Formatting"
        className={cx("xe-format", below && "xe-format-below")}
        style={aside ? ({ "--xe-format-dx": `${aside}px` } as React.CSSProperties) : undefined}
        data-edit-only
        onMouseDown={keep}
      >
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

/** Whether the formatting buttons go below the line: on a section's first line, where its toolbar sits, under a shell part's corner toolbar, and in a finding, whose controls sit above it. */
function onFirstLine(cell: HTMLElement | null): boolean {
  const field = cell?.closest(".xe-rich");
  if (!field) return false;
  if (field.parentElement?.querySelector(":scope > .xe-shell-tools")) return true;
  // A finding's own controls sit on the rule above it.
  if (field.closest("li.xp-finding")) return true;
  const frame = field.closest(".xe-frame");
  if (!frame) return false;
  return field.getBoundingClientRect().top - frame.getBoundingClientRect().top < 48;
}

/**
 * How far the formatting buttons go to the left of the line's right end so that they, and their presses under a finger,
 * keep clear of every section's toolbar as Toolbar.tsx placed it (`below`: under the line, else above it). The last
 * finding's go under its line, into the gap where the section below has its toolbar on its top edge (an essay with its
 * findings moved to the top). The toolbar keeps its place, its grip at its section's corner. 0 where nothing is in the way.
 */
function clearOfToolbars(cell: HTMLElement | null, below: boolean): number {
  const field = cell?.closest<HTMLElement>(".xe-rich");
  const bar = field?.querySelector<HTMLElement>(".xe-format");
  const first = bar?.querySelector<HTMLElement>("button");
  if (!field || !bar || !first) return 0;
  const f = field.getBoundingClientRect();
  const w = bar.offsetWidth;
  const h = first.offsetHeight;
  // Under a finger each takes a 44px press, 8px round it (css/core.css, .xe-tool-sm).
  const reach = window.matchMedia("(pointer: coarse)").matches ? 8 : 0;
  // Under the line it starts at the line's foot; above it, 0.25rem over the line (the bar's own padding).
  const top = below ? f.bottom : f.top - 4 - h;
  const tools = [...document.querySelectorAll<HTMLElement>('[data-editor="page"] .xe-tools > *')].filter((t) => t.getClientRects().length > 0).map((t) => t.getBoundingClientRect());
  let dx = 0;
  // Past the toolbar it meets, and again past any it meets there; each step goes further left, so it ends.
  for (let tries = 0; tries < 4; tries++) {
    const left = f.right - dx - w - reach;
    const right = f.right - dx + reach;
    const hit = tools.filter((t) => Math.min(right, t.right) - Math.max(left, t.left) > 0.5 && Math.min(top + h + reach, t.bottom) - Math.max(top - reach, t.top) > 0.5);
    if (!hit.length) return f.right - dx - w < f.left ? 0 : dx;
    dx = Math.ceil(f.right + reach - Math.min(...hit.map((t) => t.left)) + 4);
  }
  return 0;
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
