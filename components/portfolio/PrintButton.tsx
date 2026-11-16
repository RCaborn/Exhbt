"use client";

/** "Save as PDF": opens the browser's print dialog, where PDF is one of the destinations. The print stylesheet does the rest. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="xp-link text-[0.9375rem] font-semibold print:hidden" data-save-pdf>
      Save as PDF
    </button>
  );
}
