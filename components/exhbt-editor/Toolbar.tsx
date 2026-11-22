"use client";

import { ArrowDown, ArrowUp, GripVertical, Star, Trash2 } from "lucide-react";
import { FORMAT_RULES, formatOf, type Format } from "@/lib/exhbt/formats";
import { pageItems } from "@/lib/exhbt/layouts";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import type { ItemAs } from "@/lib/exhbt/layouts";
import { useBoard } from "./drag";
import { MoreActions } from "./draft-tools";
import { useFrame } from "./Frame";
import { labelOf } from "./labels";
import { useDoc, useStoreInternal } from "./store";
import type { Store } from "./store-core";

/*
 * A section's toolbar (decision 0026, "The chrome"): at its top corner, out of the flow, so it takes no
 * room. The grip (the only thing that drags), move up, move down, the layout's own action where there
 * is one, "More actions" where the AI drafted the part, and Remove (none on the flowchart where the
 * layout always has one). With a mouse it shows on hover and on focus within; on a touch screen wider
 * than 48rem it is always shown, at 44px; on a phone only the grip shows (css/phone.css, L's). Each
 * button has a tooltip. The buttons carry data-grip or data-tool, so other parts' CSS and tests can
 * find them.
 */

/** One of the layout's own actions for a page item, as the toolbar draws it and the phone's bar (L's PhoneBar.tsx) does. */
export type LayoutAction = { name: string; tool: "action"; pressed?: boolean; run(): void; icon?: React.ReactNode };

/**
 * The layout's own actions for page item `id` (of `kind`) in layout `f`: "Make lead image" or "Make
 * key figure" while it is not the one, or Before and After on a before-and-after picture; none for
 * anything else. `as`, how the page draws the item, says whether it is the lead or key figure already
 * (the toolbar has it from its frame); without it the page's order says, worked out from `d`.
 */
export function actionsFor(d: ExhbtDoc, id: string, kind: string, f: Format, store: Store, as?: ItemAs): LayoutAction[] {
  const first = FORMAT_RULES[f].first;
  const leads = (it: { kind: string }) => (first?.kinds as readonly string[] | undefined)?.includes(it.kind) ?? false;
  if (first && leads({ kind })) {
    const already = as !== undefined ? as === first.as : pageItems(d).find(leads)?.id === id;
    if (already) return [];
    // The lead's place is read when the button is pressed: working out the page's items for every toolbar each time it draws (every frame's, at a drop) costs more than the press.
    const lead = () => pageItems(store.get()).findIndex(leads);
    return [{ name: first.as === "lead" ? "Make lead image" : "Make key figure", tool: "action", icon: <Star aria-hidden size={15} strokeWidth={2.25} />, run: () => store.move(id, Math.max(0, lead())) }];
  }
  if (f === "before-after" && kind === "image") {
    const s = d.sections.find((x) => x.id === id);
    const stage = s?.kind === "image" ? s.stage : undefined;
    const label = labelOf(d, id).toLowerCase();
    return (["before", "after"] as const).map((v) => ({
      name: v === "before" ? "Before" : "After",
      tool: "action",
      pressed: stage === v,
      run: () => store.patch(id, (x) => (x.kind === "image" ? (x.stage === v ? (({ stage: _s, ...rest }) => (void _s, rest))(x) : { ...x, stage: v }) : x), `${v} on ${label}`),
    }));
  }
  return [];
}

function Tool({ name, tool, onClick, disabled, pressed, children }: { name: string; tool: string; onClick(): void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="xe-tool" data-tool={tool} aria-label={name} data-tip={name} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function Toolbar() {
  const frame = useFrame();
  const store = useStoreInternal();
  const board = useBoard();
  const id = frame?.id ?? "";
  const label = useDoc((d) => labelOf(d, id));
  const f = useDoc((d) => formatOf(d));
  // The layout's action depends on the page's order; read when the frame draws (it draws on every structural change).
  const actions = frame ? actionsFor(store.get(), id, frame.kind, f, store, frame.as) : [];
  if (!frame) return null;
  const { place, count, kind } = frame;
  const removable = kind !== "flow" || FORMAT_RULES[f].flowRemovable;
  const block = kind === "flow" ? "flow" : kind === "findings" ? "findings" : null;
  return (
    <div className="xe-tools" data-edit-only role="toolbar" aria-label={`${label}: tools`}>
      <button type="button" className="xe-tool xe-grip" data-grip aria-label={`Drag ${label} to move it`} data-tip={`Drag ${label} to move it`} {...board.grip(id)}>
        <GripVertical aria-hidden size={16} strokeWidth={2.25} />
      </button>
      <Tool name={`Move ${label} up`} tool="up" disabled={place <= 0} onClick={() => board.moveBy(id, -1)}>
        <ArrowUp aria-hidden size={15} strokeWidth={2.25} />
      </Tool>
      <Tool name={`Move ${label} down`} tool="down" disabled={place >= count - 1} onClick={() => board.moveBy(id, 1)}>
        <ArrowDown aria-hidden size={15} strokeWidth={2.25} />
      </Tool>
      {actions.map((a) => (
        <Tool key={a.name} name={a.name} tool={a.tool} pressed={a.pressed} onClick={a.run}>
          {a.icon ?? <span className="xe-tool-word">{a.name}</span>}
        </Tool>
      ))}
      {block && (
        <span className="xe-more" data-tool="more">
          <MoreActions block={block} />
        </span>
      )}
      {removable && (
        <Tool name={`Remove ${label}`} tool="remove" onClick={() => board.remove(id)}>
          <Trash2 aria-hidden size={15} strokeWidth={2.25} />
        </Tool>
      )}
    </div>
  );
}
