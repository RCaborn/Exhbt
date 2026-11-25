"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A polite live region that says the same words twice. A screen reader speaks a live region when its text
 * changes, so a second identical message changed nothing and was silent. Here every message (a new `n`) first
 * empties the region, then sets the words a moment later, which counts as a change each time.
 * `n` is the message count; `data-said` is put on the region for tests.
 */
export function Said({ text, n, className = "sr-only", ...props }: { text: string; n: number; className?: string; role?: "status"; "data-said"?: number }): ReactNode {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    if (!text) return;
    const t = setTimeout(() => setShown(text), 60);
    return () => clearTimeout(t);
  }, [text, n]);
  return (
    <div aria-live="polite" className={className} {...props}>
      {shown}
    </div>
  );
}
