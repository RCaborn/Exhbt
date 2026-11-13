"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** "Copy link": copies an address (made absolute with this site's origin if it starts with /) and says so. */
export function CopyLink({ href, label = "Copy link", size = "md" }: { href: string; label?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  async function copy() {
    const full = href.startsWith("/") ? `${window.location.origin}${href}` : href;
    try {
      await navigator.clipboard.writeText(full);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch {
      window.prompt("Copy this link", full);
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button size={size} onClick={copy} label={label}>
        {done ? <Check aria-hidden size={15} strokeWidth={2.25} /> : <Copy aria-hidden size={15} strokeWidth={2.25} />}
        {label}
      </Button>
      <span role="status" className="sr-only">
        {done ? "Link copied" : ""}
      </span>
      {done && (
        <span aria-hidden className="text-sm text-graphite">
          Copied
        </span>
      )}
    </span>
  );
}
