"use client";

import type { ReactNode } from "react";
import type { ExtraSlot } from "@/components/portfolio/page-ctx";
import { useDoc, useSection, useStore } from "../store";

/*
 * A link's "Web address" (decision 0026): a button over the link's corner, always shown and marked
 * while the address is missing, opening a native popover that holds the field (path
 * sections.N.href). J's: this is G's stub.
 */
export function LinkExtras(props: ExtraSlot): ReactNode {
  const store = useStore();
  const s = useSection(props.sectionId);
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === props.sectionId));
  if (props.where !== "over" || s?.kind !== "link") return null;
  const id = `${props.sectionId}-href`;
  const path = `sections.${index}.href`;
  return (
    <span className="xe-over" data-edit-only>
      <button type="button" className="xe-chip" popoverTarget={`${id}-pop`} data-missing={s.href.trim() ? undefined : ""}>
        Web address
      </button>
      <div popover="auto" id={`${id}-pop`} className="xe-popover">
        <label htmlFor={id} className="xe-popover-label">
          Web address
        </label>
        <input id={id} type="url" className="xe-popover-input" data-path={path} value={s.href} placeholder="https://" onChange={(e) => store.setAt(path, e.target.value)} />
      </div>
    </span>
  );
}
