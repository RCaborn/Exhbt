"use client";

import { ArrowDown, ArrowUp, GripVertical, Star, Trash2 } from "lucide-react";
import { FORMAT_RULES, formatOf, type Format } from "@/lib/exhbt/formats";
import { pageItems } from "@/lib/exhbt/layouts";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { useBoard } from "./drag";
import { MoreActions } from "./draft-tools";
import { useFrame } from "./Frame";
import { labelOf } from "./labels";
import { useDoc, useStoreInternal } from "./store";

/*
 * A section's toolbar (decision 0026, "The chrome"): at its top corner, out of the flow, so it takes no
 * room. The grip (the only thing that drags), move up, move down, the layout's own action where there
 * is one, "More actions" where the AI drafted the part, and Remove (none on the flowchart where the
 * layout always has one). With a mouse it shows on hover and on focus within; on a touch screen wider
 * than 48rem it is always shown, at 44px; on a phone only the grip shows (css/phone.css, L's). Each
 * button has a tooltip. The buttons carry data-grip or data-tool, so other parts' CSS and tests can
 * find them.
 */

type Action = { name: string; tool: "action"; pressed?: boolean; run(): void; icon?: React.ReactNode };

/** The layout's own action for this item: make it the lead image or the key figure, or mark a picture Before or After. */
function actionsFor(d: ExhbtDoc, id: string, kind: string, as: string, f: Format, store: ReturnType<typeof useStoreInternal>): Action[] {
  const first = FORMAT_RULES[f].first;
  if (first && (first.kinds as readonly string[]).includes(kind) && as !== first.as) {
    // The lead's place is read when the button is pressed: working out the page's items for every toolbar each time it draws (every frame's, at a drop) costs more than the press.
    const lead = () => pageItems(store.get()).findIndex((it) => (first.kinds as readonly string[]).includes(it.kind));
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
  const actions = frame ? actionsFor(store.get(), id, frame.kind, frame.as, f, store) : [];
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
