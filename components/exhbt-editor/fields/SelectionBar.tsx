"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { Card } from "@astryxdesign/core/Card";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useLayer } from "@astryxdesign/core/Layer";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { Bold, Check, Highlighter, Italic, Link2, Unlink, X } from "lucide-react";
import { safeHref } from "@/lib/exhbt/blocks";

/*
 * The formatting controls that come to the words a person has selected (decision 0032; Rory, 26 Nov 2026:
 * "I should be able to bold and italicise text as I please", written after selecting words in a quote and
 * finding nothing to press). While words are selected in a formatted field, with a mouse or with the
 * keyboard, this bar sits just above them: Bold and Italic (Highlight on the context line), and Link where
 * the field takes links. Link turns the bar into the address field, so the address is typed where the
 * words are, and gives the cursor back to the words when it is done.
 *
 * App chrome, so it is Astryx throughout: a fixed layer (`useLayer`, the foundation Astryx gives for a
 * layer placed by hand; its Popover hangs from a button and keeps the focus, and this hangs from a
 * selection and must not take it), a Card for the surface, a Toolbar of ToggleButtons and IconButtons,
 * each with Astryx's own tooltip, and a TextInput for the address. It is in the browser's top layer, so
 * nothing on the page moves when it comes or goes, and it is drawn inside its field's own box in the
 * markup, so "the Bold button of this field" finds it.
 *
 * Only with a fine pointer (RichEditor.tsx decides): under a finger the phone's bar at the foot of the
 * screen holds these buttons, and a tablet keeps the ones at the end of the line, clear of the system's
 * own copy and paste bubble, which sits where this would.
 */

const LINK_ERROR = "Links must start with https://.";
/** The gap between the bar and the words, and the least it keeps from the window's edges. */
const GAP = 8;
const EDGE = 8;

type Flags = { bold: boolean; italic: boolean; link: boolean };

export type SelectionBarProps = {
  editor: Editor;
  /** The context line: one button, Highlight, in place of Bold and Italic. */
  highlight: boolean;
  /** Whether the field takes links. */
  links: boolean;
  flags: Flags;
  /** The bar's element, so the field knows the focus is still its own while it is in the bar. */
  barRef: RefObject<HTMLDivElement | null>;
  /** Asking for a link's address: the bar stays up while the address field has the cursor. */
  linking: boolean;
  setLinking(on: boolean): void;
};

/** Where the selected words are on the screen: the first line's part of them, and the last line's foot. */
function selectionBox(editor: Editor): { left: number; right: number; top: number; bottom: number } | null {
  const sel = window.getSelection();
  const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  if (range && !range.collapsed && editor.view.dom.contains(range.commonAncestorContainer)) {
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (rects.length) {
      const top = Math.min(...rects.map((r) => r.top));
      const first = rects.filter((r) => r.top - top < 4);
      return { left: Math.min(...first.map((r) => r.left)), right: Math.max(...first.map((r) => r.right)), top, bottom: Math.max(...rects.map((r) => r.bottom)) };
    }
  }
  // No selection on the screen to read (the address field has it): where the editor says the words are.
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const a = editor.view.coordsAtPos(from);
  const b = editor.view.coordsAtPos(to, -1);
  const oneLine = Math.abs(a.top - b.top) < 4;
  return { left: a.left, right: oneLine ? b.right : editor.view.dom.getBoundingClientRect().right, top: a.top, bottom: b.bottom };
}

export function SelectionBar({ editor, highlight, links, flags, barRef, linking, setLinking }: SelectionBarProps) {
  const layer = useLayer({ mode: "fixed" });
  const { show, hide } = layer;
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [address, setAddress] = useState("");
  const [error, setError] = useState(false);
  // Where the words were when the address was asked for: the address field takes the selection off the screen.
  const held = useRef<ReturnType<typeof selectionBox>>(null);

  const place = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const box = (linking && held.current) || selectionBox(editor);
    if (!box) return;
    held.current = box;
    const { width, height } = bar.getBoundingClientRect();
    // Above the words; under them where the editor's top bar, or the top of the window, leaves no room above.
    const ceiling = (document.querySelector('[data-editor="page"] [data-topbar]')?.getBoundingClientRect().bottom ?? 0) + EDGE;
    const above = box.top - height - GAP;
    const y = above >= ceiling ? above : box.bottom + GAP;
    const x = Math.max(EDGE, Math.min((box.left + box.right) / 2 - width / 2, document.documentElement.clientWidth - width - EDGE));
    setAt((cur) => (cur && Math.abs(cur.x - x) < 0.5 && Math.abs(cur.y - y) < 0.5 ? cur : { x: Math.round(x), y: Math.round(y) }));
  }, [barRef, editor, linking]);

  // Shown for as long as it is mounted: the field mounts it only while words are selected.
  useEffect(() => {
    show();
    return () => hide();
  }, [show, hide]);

  // Placed before it is painted, and again whenever the selection, its marks or the bar's own size change.
  useLayoutEffect(place);

  // It follows the words while the page scrolls or the window changes size.
  useEffect(() => {
    let frame = 0;
    const soon = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          // The words have scrolled with the page, so they are read again.
          if (!linking) held.current = null;
          else if (held.current) held.current = selectionBox(editor) ?? held.current;
          place();
        });
    };
    window.addEventListener("scroll", soon, { capture: true, passive: true });
    window.addEventListener("resize", soon);
    editor.on("selectionUpdate", soon);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon, { capture: true });
      window.removeEventListener("resize", soon);
      editor.off("selectionUpdate", soon);
    };
  }, [editor, linking, place]);

  const toWords = () => editor.commands.focus(null, { scrollIntoView: false });
  const stopLinking = () => {
    setLinking(false);
    setAddress("");
    setError(false);
  };
  const addLink = () => {
    const href = safeHref(address.trim());
    if (!href) return setError(true);
    editor.chain().focus(null, { scrollIntoView: false }).extendMarkRange("link").setLink({ href }).run();
    stopLinking();
  };
  const cancelLink = () => {
    stopLinking();
    toWords();
  };

  return layer.render(
    <div
      ref={barRef}
      className="xe-selbar"
      data-edit-only
      data-linking={linking ? "" : undefined}
      // A press on a button never takes the cursor out of the words; the address field takes it as any field does.
      onMouseDown={(e) => {
        if ((e.target as Element).closest("button")) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        if (linking) cancelLink();
        else toWords();
      }}
    >
      <Card padding={1} elevation="med">
        {linking ? (
          // A plain row, not a toolbar: a toolbar's arrow keys move along its buttons, and in a text field they move the cursor.
          <div role="group" aria-label="Add a link">
            <HStack gap={1} vAlign="center">
              <TextInput
                type="url"
                inputMode="url"
                autoComplete="url"
                hasSpellCheck={false}
                hasAutoFocus
                size="sm"
                width={260}
                label="Link address (starting https://)"
                isLabelHidden
                placeholder="https://"
                value={address}
                onChange={(v) => {
                  setAddress(v);
                  setError(false);
                }}
                onEnter={addLink}
                status={error ? { type: "error" } : undefined}
              />
              <IconButton label="Add link" tooltip="Add link" size="sm" variant="ghost" icon={<Check aria-hidden size={16} strokeWidth={2.5} />} onClick={addLink} />
              <IconButton label="Cancel" tooltip="Cancel" size="sm" variant="ghost" icon={<X aria-hidden size={16} strokeWidth={2.5} />} onClick={cancelLink} />
            </HStack>
            {/* Said at once, and found by its role, as the field's own address prompt says it. */}
            {error && (
              <p role="alert" className="xe-selbar-error">
                {LINK_ERROR}
              </p>
            )}
          </div>
        ) : (
          <Toolbar
            label="Formatting"
            size="sm"
            gap={0.5}
            startContent={
              <>
                {highlight ? (
                  <ToggleButton label="Highlight" isPressed={flags.bold} icon={<Highlighter aria-hidden size={16} strokeWidth={2.25} />} onPressedChange={() => editor.chain().focus(null, { scrollIntoView: false }).toggleBold().run()}>
                    Highlight
                  </ToggleButton>
                ) : (
                  <>
                    <ToggleButton label="Bold" tooltip="Bold" isIconOnly isPressed={flags.bold} icon={<Bold aria-hidden size={16} strokeWidth={2.5} />} onPressedChange={() => editor.chain().focus(null, { scrollIntoView: false }).toggleBold().run()} />
                    <ToggleButton label="Italic" tooltip="Italic" isIconOnly isPressed={flags.italic} icon={<Italic aria-hidden size={16} strokeWidth={2.5} />} onPressedChange={() => editor.chain().focus(null, { scrollIntoView: false }).toggleItalic().run()} />
                  </>
                )}
                {links &&
                  (flags.link ? (
                    <IconButton label="Remove link" tooltip="Remove link" variant="ghost" icon={<Unlink aria-hidden size={16} strokeWidth={2.25} />} onClick={() => editor.chain().focus(null, { scrollIntoView: false }).extendMarkRange("link").unsetLink().run()} />
                  ) : (
                    <IconButton label="Link" tooltip="Link" variant="ghost" icon={<Link2 aria-hidden size={16} strokeWidth={2.25} />} onClick={() => setLinking(true)} />
                  ))}
              </>
            }
          />
        )}
      </Card>
    </div>,
    { x: at?.x ?? -9999, y: at?.y ?? -9999 },
  );
}
