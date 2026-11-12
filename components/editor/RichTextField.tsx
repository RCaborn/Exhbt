"use client";

import { useEffect, useState } from "react";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import History from "@tiptap/extension-history";
import { Bold as BoldIcon, Italic as ItalicIcon, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { safeHref, type RichText } from "@/lib/exhbt/blocks";
import { docToRuns, runsToDoc, sameRuns, type TiptapNode } from "@/lib/exhbt/richtext-tiptap";

/** One paragraph per field, and Enter doesn't start another. */
const OneParagraph = Document.extend({ content: "paragraph" });
const NoNewParagraphs = Extension.create({
  name: "noNewParagraphs",
  addKeyboardShortcuts: () => ({ Enter: () => true, "Shift-Enter": () => true, "Mod-Enter": () => true }),
});

/**
 * A minimal Tiptap editor for one text field: bold, italic and https links, nothing else
 * (decision 0007). Stores our own runs (lib/exhbt/richtext-tiptap.ts), never HTML.
 * Loaded only on the editor page, in its own chunk (components/editor/Editor.tsx).
 */
export function RichTextField({
  value,
  onChange,
  labelId,
  describedBy,
}: {
  value: RichText;
  onChange: (runs: RichText) => void;
  /** id of the visible label, read out as the field's name. */
  labelId: string;
  describedBy?: string;
}) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      OneParagraph,
      Paragraph,
      Text,
      Bold,
      Italic,
      History,
      NoNewParagraphs,
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "nofollow ugc noopener", target: null, class: "link" },
        isAllowedUri: (url) => safeHref(url) !== null,
      }),
    ],
    content: runsToDoc(value),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class: "field min-h-[2.9rem] leading-relaxed whitespace-pre-wrap",
      },
    },
    onUpdate: ({ editor: e }) => onChange(docToRuns(e.getJSON() as TiptapNode)),
  });

  // Changes from outside (reordering, undoing a removal) replace the content; typing doesn't.
  useEffect(() => {
    if (editor && !sameRuns(value, docToRuns(editor.getJSON() as TiptapNode))) {
      editor.commands.setContent(runsToDoc(value), { emitUpdate: false });
    }
  }, [editor, value]);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ bold: e?.isActive("bold") ?? false, italic: e?.isActive("italic") ?? false, link: e?.isActive("link") ?? false }),
  });

  function link() {
    if (!editor) return;
    if (active?.link) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const raw = window.prompt("Link address (starting https://)");
    if (raw === null) return;
    const href = safeHref(raw.trim());
    if (!href) {
      setLinkError("Links must start with https://.");
      return;
    }
    setLinkError(null);
    const chain = editor.chain().focus();
    if (editor.state.selection.empty) chain.insertContent({ type: "text", text: raw.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    else chain.extendMarkRange("link").setLink({ href }).run();
  }

  return (
    <div>
      <div role="toolbar" aria-label="Formatting" className="mb-1.5 flex justify-end gap-1.5">
        <Button size="sm" variant={active?.bold ? "ink" : "secondary"} label={active?.bold ? "Bold, on" : "Bold"} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <BoldIcon aria-hidden size={14} strokeWidth={2.5} />
        </Button>
        <Button size="sm" variant={active?.italic ? "ink" : "secondary"} label={active?.italic ? "Italic, on" : "Italic"} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <ItalicIcon aria-hidden size={14} strokeWidth={2.5} />
        </Button>
        <Button size="sm" variant={active?.link ? "ink" : "secondary"} label={active?.link ? "Remove link" : "Link"} onClick={link}>
          {active?.link ? <Unlink aria-hidden size={14} strokeWidth={2.5} /> : <Link2 aria-hidden size={14} strokeWidth={2.5} />}
        </Button>
      </div>
      <EditorContent editor={editor} />
      {linkError && (
        <p role="alert" className="mt-1 text-sm text-error">
          {linkError}
        </p>
      )}
    </div>
  );
}
