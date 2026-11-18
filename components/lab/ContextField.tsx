"use client";

import { useEffect } from "react";
import { Extension, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import History from "@tiptap/extension-history";
import { Highlighter } from "lucide-react";
import { RichText } from "@/components/exhbt/RichText";
import { docToRuns, runsToDoc, sameRuns, type TiptapNode } from "@/lib/exhbt/richtext-tiptap";
import { useLab, useLabStore, useRenderCount } from "./store";

/** One paragraph, and Enter doesn't start another (as components/editor/RichTextField.tsx). */
const OneParagraph = Document.extend({ content: "paragraph" });
const NoNewParagraphs = Extension.create({
  name: "noNewParagraphs",
  addKeyboardShortcuts: () => ({ Enter: () => true, "Shift-Enter": () => true, "Mod-Enter": () => true }),
});

/**
 * The highlighted phrase. Stored as bold, as everywhere else (decision 0022), but drawn in the
 * field the way the page draws it, as `<mark class="xp-mark">`, so the line being typed is the
 * line that will be published, block of colour included.
 */
const Highlight = Bold.extend({
  parseHTML: () => [{ tag: "mark" }, { tag: "strong" }, { tag: "b" }],
  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(HTMLAttributes, { class: "xp-mark" }), 0];
  },
});

const LINE = "xp-context mt-5 max-w-[42rem] text-[1.0625rem] leading-[1.6] @2xl/main:text-[1.1875rem]";

/**
 * The context line under the title, typed in place: a lab variant of the editor's Tiptap field
 * (components/editor/RichTextField.tsx), with no box, in the line's own type, and one button,
 * Highlight, which shows above the line's right end only while the line has the focus (it sits
 * outside the flow, so nothing moves when it appears). Until Tiptap has started, the line is
 * drawn as the page draws it, so the page doesn't jump when the field takes over.
 */
export function ContextField() {
  const store = useLabStore();
  const gap = useLab((d) => d.gap);
  useRenderCount("context");
  const editor = useEditor({
    immediatelyRender: false,
    // Tiptap's stylesheet changes how the line wraps and switches ligatures off; lab.css has what the field needs instead.
    injectCSS: false,
    extensions: [OneParagraph, Paragraph, Text, Highlight, History, NoNewParagraphs],
    content: runsToDoc(gap),
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Context line", class: "lab-context-editor" } },
    onUpdate: ({ editor: e }) => store.setGap(docToRuns(e.getJSON() as TiptapNode)),
  });

  // Changes from outside (Reset, another sample) replace the words; typing doesn't.
  useEffect(() => {
    if (editor && !sameRuns(gap, docToRuns(editor.getJSON() as TiptapNode))) editor.commands.setContent(runsToDoc(gap), { emitUpdate: false });
  }, [editor, gap]);

  const on = useEditorState({ editor, selector: ({ editor: e }) => e?.isActive("bold") ?? false });

  if (!editor) {
    return (
      <p className={LINE} data-lab-context="static">
        <RichText value={gap} highlight />
      </p>
    );
  }
  return (
    <div className={`lab-context relative ${LINE}`} data-lab-context="field">
      <div className="lab-context-tools">
        <button
          type="button"
          aria-pressed={Boolean(on)}
          // Keeps the selection in the line while the button is pressed.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="xp-outline-button inline-flex h-9 items-center gap-1.5 px-3 text-[0.8125rem] font-semibold"
        >
          <Highlighter aria-hidden size={14} strokeWidth={2.5} />
          Highlight
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
