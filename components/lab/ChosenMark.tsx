import { Check } from "lucide-react";

/**
 * The mark on a chosen card (a plan, a layout): an ink disc with a white check, the same size as the
 * site's tick. Chosen is ink; the mint tick is kept for "done" and "checked" (the kit's rule: mint
 * means go, live and checked). Decorative: the card itself says it is selected.
 */
export function ChosenMark() {
  return (
    <span aria-hidden data-chosen-mark className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-white">
      <Check aria-hidden size={13} strokeWidth={3} />
    </span>
  );
}
