"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import type { InsertSlot } from "@/components/portfolio/page-ctx";
import { blockOptions, type BlockOption } from "@/lib/exhbt/layouts";
import { useBoard } from "./drag";
import { labelAt } from "./labels";
import { useStoreInternal } from "./store";

/*
 * The "+" in the gap above each row and after the last (decision 0026, "The chrome"). F's: this is G's
 * stub, a button that lists what blockOptions offers and adds the chosen kind at its place. It takes no
 * room: a zero-height element in the gap, the button drawn over the gap.
 */
export function Insert({ at, end }: InsertSlot) {
  const store = useStoreInternal();
  const board = useBoard();
  const [options, setOptions] = useState<BlockOption[] | null>(null);
  const menuId = useId();
  const before = end ? null : labelAt(store.get(), at);
  const name = before ? `Add a section before ${before}` : "Add a section";
  return (
    <div className="xe-insert" data-edit-only data-at={at} data-path={end ? "sections" : undefined}>
      <button
        type="button"
        className="xe-insert-button"
        aria-label={name}
        data-tip={name}
        aria-expanded={options !== null}
        aria-controls={menuId}
        onClick={() => setOptions((o) => (o ? null : blockOptions(store.get())))}
      >
        <Plus aria-hidden size={16} strokeWidth={2.5} />
      </button>
      {options && (
        <div id={menuId} role="group" aria-label={name} className="xe-insert-menu">
          {options.map((o) => (
            <button
              key={o.kind}
              type="button"
              disabled={Boolean(o.full)}
              onClick={() => {
                setOptions(null);
                board.add(o.kind, at);
              }}
            >
              <span>{o.name}</span>
              {o.full && <span className="xe-insert-full">{o.full}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
