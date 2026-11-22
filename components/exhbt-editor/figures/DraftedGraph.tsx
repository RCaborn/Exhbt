"use client";

import "../css/figures.css";
import { useState, type ReactNode } from "react";
import { draftedGraph } from "@/app/(app)/exhbts/[id]/figure-actions";
import type { ExhbtDoc } from "@/lib/exhbt/blocks";
import { mergeUnverified } from "@/lib/exhbt/draft-blocks";
import { FORMAT_RULES, formatOf, type PageKind } from "@/lib/exhbt/formats";
import { insertBlock, pageItems } from "@/lib/exhbt/layouts";
import { roomFor } from "@/lib/exhbt/sections";
import { useEnv, useRuntime } from "../context";
import { useDoc, useStoreInternal } from "../store";

/*
 * "Put back the chart drafted from your numbers" (decisions 0025 and 0026, "The key visual"): a quiet
 * line under the page. When a figure from the person's report took the place of the graph the draft
 * drew, that graph was kept with the AI version. Once the report's own graph or table is off the page
 * (removed, say, because it isn't theirs to share), and the exhbt has no graph, the line offers it
 * back. Putting it back asks the server (figure-actions.ts), which checks its numbers against the
 * source again; the graph goes where the layout wants its figure and its flagged numbers join the
 * numbers to check, as one undo entry. An exhbt drafted before release 2 kept no graphs: no line.
 */
export function DraftedGraph(): ReactNode {
  const env = useEnv();
  const kept = env.draftTools?.aiVersion.graphs?.length ?? 0;
  const show = useDoc((d) => kept > 0 && offersDraftedGraph(d));
  if (!show) return null;
  return <PutBack />;
}

/** No graph on the exhbt, no picked graph or table on it, and room for a graph in this layout. */
function offersDraftedGraph(d: ExhbtDoc): boolean {
  if (d.sections.some((s) => s.kind === "graph" || (s.kind === "image" && (s.picked?.kind === "graph" || s.picked?.kind === "table")))) return false;
  const f = formatOf(d);
  return FORMAT_RULES[f].kinds.includes("graph") && roomFor(d.sections, "graph", f) > 0;
}

/**
 * Where the layout wants its graph, as a page place: in research before the first figure (a drafted
 * graph is the key figure, 0025); elsewhere before the first part that comes after a graph in the
 * layout's usual order (a case study's: straight after its findings and any graphs).
 */
export function graphPlace(d: ExhbtDoc): number {
  const items = pageItems(d);
  const f = formatOf(d);
  if (f === "research") {
    const first = items.findIndex((it) => it.kind === "graph" || it.kind === "image");
    if (first >= 0) return first;
  }
  const slots = slotsOf([...items.map((it) => it.kind), "graph"], f);
  const mine = slots[slots.length - 1]!;
  const after = slots.slice(0, -1).findIndex((k) => k > mine);
  return after < 0 ? items.length : after;
}

/** Each kind's place in the layout's usual order, a `first` slot taken by the first of its kinds only (as lib/exhbt/layouts.ts sorts a layout switch). */
function slotsOf(kinds: PageKind[], f: ReturnType<typeof formatOf>): number[] {
  const template = FORMAT_RULES[f].template;
  const taken = new Set<number>();
  return kinds.map((kind) => {
    for (let k = 0; k < template.length; k++) {
      const slot = template[k]!;
      if (!slot.kinds.includes(kind)) continue;
      if (slot.first) {
        if (taken.has(k)) continue;
        taken.add(k);
      }
      return k;
    }
    return template.length;
  });
}

function PutBack() {
  const env = useEnv();
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function putBack() {
    setBusy(true);
    setError(null);
    try {
      const r = await draftedGraph(env.id, 0);
      if (!r.ok) return setError(r.error);
      const added = { id: "" };
      store.patchDoc((d) => {
        const ins = insertBlock(d, "graph", graphPlace(d));
        if (!ins) return d;
        added.id = ins.id;
        const sections = ins.doc.sections.map((s) => (s.id === ins.id && s.kind === "graph" ? { ...s, chart: r.chart } : s));
        return { ...ins.doc, sections, unverified: mergeUnverified(ins.doc.unverified ?? [], r.flags) };
      }, "put the drafted chart back");
      if (!added.id) return setError("There's no room for a graph in this layout.");
      const n = r.flags.length;
      uiApi.say(`The drafted chart is back.${n ? ` Check the ${n === 1 ? "number" : `${n} numbers`} flagged at the top.` : ""}`);
      // This line goes with it: the cursor goes to the graph's "Edit figures".
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const chip = document.querySelector<HTMLElement>(`[data-editor="page"] [data-section-id="${CSS.escape(added.id)}"] .xe-fig-graph button`);
          chip?.scrollIntoView({ block: "center" });
          chip?.focus({ preventScroll: true });
        }),
      );
    } catch {
      setError("Couldn't reach the server. Nothing was changed. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="xe-fig-drafted" data-edit-only data-testid="drafted-graph">
      <p>
        The chart drafted from your numbers is kept.{" "}
        <button type="button" className="xe-fig-chip" disabled={busy} onClick={() => void putBack()}>
          {busy ? "Putting it back…" : "Put it back"}
        </button>
      </p>
      {error && (
        <p role="alert" className="xe-fig-drafted-error">
          {error}
        </p>
      )}
    </div>
  );
}
