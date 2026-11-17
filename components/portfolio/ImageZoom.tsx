"use client";

/* eslint-disable @next/next/no-img-element -- signed Storage URLs; see Avatar.tsx. */
import { useId, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { RichText } from "@/components/exhbt/RichText";
import type { RichText as RichTextValue } from "@/lib/exhbt/blocks";

/**
 * A picture that opens larger in a dialog, one at a time (decision 0024). The button holds the
 * picture, so its name is the alt text; a click, Enter or Space opens a native <dialog> with
 * showModal(), which traps focus, closes on Escape and puts focus back on the button.
 *
 * The dialog is drawn inside the exhbt page (not in a portal), so it inherits the --xp-*
 * variables and every portfolio look styles it. There is no Previous or Next and nothing moves
 * (DESIGN.md bans carousels and motion), so it is a viewer, not a carousel. Pinch zoom is never
 * disabled. The Astryx Lightbox was not used: it paints itself from Astryx's own theme tokens, not
 * the page's variables, and brings a close icon, motion options and gallery controls we don't want.
 * With JavaScript off the picture still shows; it just doesn't open larger.
 *
 * The caption stays outside the button, in the server parent, so it is read once.
 */
export function ImageZoom({
  src,
  alt,
  caption,
  w,
  h,
  className = "",
  imgClassName = "",
  imgStyle,
  priority = false,
}: {
  src: string;
  alt: string;
  /** Shown under the picture in the dialog. */
  caption?: RichTextValue;
  w?: number;
  h?: number;
  /** On the button. */
  className?: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  /** The lead image: fetched first. Nothing here is ever lazy, because Chrome prints unscrolled lazy pictures blank. */
  priority?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  const captionId = useId();
  const hasCaption = Boolean(caption && caption.some((r) => r.t.trim()));

  function open() {
    setOpened(true);
    // The dialog's picture is drawn on the next render; showModal needs the dialog in the page, which it already is.
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <button ref={trigger} type="button" aria-haspopup="dialog" onClick={open} className={`xp-zoom relative block ${className}`}>
        <img src={src} alt={alt} width={w} height={h} decoding="async" fetchPriority={priority ? "high" : undefined} className={imgClassName} style={imgStyle} />
        <span className="sr-only"> (view larger)</span>
        <span aria-hidden className="xp-zoom-chip print:hidden">
          <Maximize2 size={14} strokeWidth={2.25} />
        </span>
      </button>
      <dialog
        ref={dialog}
        className="xp-zoom-dialog"
        aria-labelledby={hasCaption ? captionId : undefined}
        aria-label={hasCaption ? undefined : alt}
        onClick={(e) => {
          // A click on the dialog itself (its backdrop) closes it; a click inside the panel doesn't.
          if (e.target === dialog.current) close();
        }}
        onClose={() => {
          setOpened(false);
          trigger.current?.focus();
        }}
      >
        <div className="xp-zoom-panel">
          <div className="flex justify-end">
            <button type="button" onClick={close} className="xp-outline-button inline-flex h-11 min-w-11 items-center justify-center px-5 text-[0.875rem] font-semibold">
              Close
            </button>
          </div>
          {opened && (
            <>
              <div className="xp-zoom-mat">
                <img src={src} alt={alt} className="xp-zoom-img" />
              </div>
              {hasCaption && (
                <p id={captionId} className="xp-muted mt-3 text-[0.9375rem] leading-snug">
                  <RichText value={caption!} />
                </p>
              )}
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
