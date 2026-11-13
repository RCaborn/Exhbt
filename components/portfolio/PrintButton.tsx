"use client";

import { Download } from "lucide-react";

/** "Save as PDF": opens the browser's print dialog, where PDF is one of the destinations. The print stylesheet does the rest. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="link inline-flex items-center gap-1.5 text-sm font-semibold text-ink print:hidden">
      <Download aria-hidden size={15} strokeWidth={2.25} />
      Save as PDF
    </button>
  );
}
