"use client";

import { useEffect } from "react";

/*
 * An iPhone's Safari zooms the page in when a field whose type is under 16px takes the focus, and does
 * not zoom back out. Nearly every field on the editing page is under 16px, because each is typed in the
 * page's own type (a flowchart box 13px, a fact or a caption 14px, a finding 15px), and those sizes
 * have to stay the visitor's page's. So while the editor is open, on an iPhone only, the viewport says
 * maximum-scale=1: Safari then leaves the page as it is when a field takes the focus, and still lets a
 * person pinch to zoom by hand (it ignores the limit for a person's own zoom). Android obeys the limit,
 * so it is never set there; an iPad does not zoom on focus, so it is not set there either. The
 * viewport is put back as it was when the editor goes.
 *
 * NOT PROVEN ON A PHONE. This is written from how Safari on an iPhone is known to behave. WebKit on
 * Linux, which the tests run on, never zooms on focus, so the tests show only that the rule is set for
 * an iPhone and for nothing else (e2e/safari.webkit.ts). Try it on a real iPhone: tap into a flowchart
 * box, a finding and a caption, and the page should stay as it is; a pinch should still zoom.
 */

/** An iPhone or an iPod touch, by its user agent. */
const IPHONE = /\b(iPhone|iPod)\b/;

export function useNoZoomOnFocus() {
  useEffect(() => {
    if (!IPHONE.test(navigator.userAgent)) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const was = meta.content;
    if (/maximum-scale/i.test(was)) return;
    meta.content = `${was}, maximum-scale=1`;
    return () => {
      meta.content = was;
    };
  }, []);
}
