"use client";

import { useContext, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { EditAdapter, ExtraSlot, ListSlot, RichSlot, ShellTools } from "@/components/portfolio/page-ctx";
import { formatLimits, LIMITS } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, formatOf } from "@/lib/exhbt/formats";
import { useRuntime } from "./context";
import { DraftToolsContext, MoreActions } from "./draft-tools";
import { InlineText } from "./fields/InlineText";
import { RichField } from "./fields/RichField";
import { GraphExtras } from "./figures/GraphExtras";
import { ImageExtras } from "./figures/ImageExtras";
import { LinkExtras } from "./figures/LinkExtras";
import { useFlowEdit } from "./flow/FlowEdit";
import { Frame, useFrame } from "./Frame";
import { PILL, SKILLS_LIST } from "./geometry";
import { Insert } from "./Insert";
import { WorkButton } from "./sheets/WorkButton";
import { useDoc, useSection, useStoreInternal } from "./store";
import { jumpTo } from "./jump";

/*
 * The editor's adapter (decision 0026, "One page, one renderer"): one stable object whose functions
 * return the editing version of each slot the page parts call. Each returns a component and nothing
 * else (they are called while a part draws, inside its lists), so the hooks are in the components.
 * Every element this adds that the visitor's page lacks carries data-edit-only, and none takes room
 * but what 0026 puts in the flow in the editor only: the placeholders, each image's description field
 * and the "Add a skill" box.
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function useAdapter(): EditAdapter {
  const flow = useFlowEdit();
  // The flowchart's slots are K's hook; the adapter stays one object whatever that hook returns.
  const flowRef = useRef(flow);
  flowRef.current = flow;
  return useMemo<EditAdapter>(
    () => ({
      text: (o) => <InlineText {...o} />,
      rich: (o) => (CAPTION.test(o.path) ? <CaptionField {...o} /> : <RichField {...o} />),
      item: (o) => <Frame {...o} />,
      insert: (o) => <Insert {...o} />,
      extra: (o) => <Extra {...o} />,
      list: (o) => <ListControls {...o} />,
      flow: {
        list: (o) => flowRef.current.list(o),
        box: (o) => flowRef.current.box(o),
        tools: (o) => flowRef.current.tools(o),
        add: (o) => flowRef.current.add(o),
      },
      skills: () => <SkillsEdit />,
      work: () => <WorkButton />,
      tools: (o) => <ShellToolbar {...o} />,
    }),
    [],
  );
}

/**
 * A shell part's corner toolbar (the title with its facts, the context line, the skills), over the
 * part's corner and out of the flow: "More actions" (rewrite, back to the AI version), with the test ids
 * tools-header, tools-gap and tools-skills, where the AI drafted the exhbt. Nothing otherwise.
 */
function ShellToolbar({ block }: ShellTools) {
  const rt = useContext(DraftToolsContext);
  if (!rt?.init) return null;
  return (
    <div className="xe-shell-tools" data-edit-only data-block={block}>
      <MoreActions block={block} />
    </div>
  );
}

/** An image's caption: the page parts cannot know the picture's number, so its name ("Image 2 caption") comes from the path here. */
const CAPTION = /^sections\.(\d+)\.caption$/;
function CaptionField(o: RichSlot) {
  const at = Number(o.path.match(CAPTION)![1]);
  const n = useDoc((d) => d.sections.slice(0, at + 1).filter((s) => s.kind === "image").length);
  return <RichField {...o} label={`Image ${Math.max(1, n)} caption`} />;
}

function Extra(o: ExtraSlot) {
  switch (o.kind) {
    case "image":
      return <ImageExtras {...o} />;
    case "link":
      return <LinkExtras {...o} />;
    case "graph":
      return <GraphExtras {...o} />;
    case "aim":
      return o.where === "above" ? <AimSwitch sectionId={o.sectionId} /> : null;
    default:
      return null;
  }
}

/** The aim or hypothesis switch, over the aim's top edge (decision 0026). */
function AimSwitch({ sectionId }: { sectionId: string }) {
  const store = useStoreInternal();
  const s = useSection(sectionId);
  const heading = s?.kind === "aim" ? (s.heading ?? "aim") : "aim";
  return (
    <span className="xe-above" data-edit-only role="group" aria-label="Aim or hypothesis">
      {(["aim", "hypothesis"] as const).map((h) => (
        <button key={h} type="button" className="xe-chip" aria-pressed={heading === h} onClick={() => store.patch(sectionId, (x) => (x.kind === "aim" ? { ...x, heading: h } : x))}>
          {h === "aim" ? "Aim" : "Hypothesis"}
        </button>
      ))}
    </span>
  );
}

/** A finding's controls (move up, move down, remove), drawn over its line; at `index === n`, "Add a finding", in the gap below the last. */
function ListControls({ path, index, n }: ListSlot) {
  const frame = useFrame();
  const store = useStoreInternal();
  const max = useDoc((d) => formatLimits(formatOf(d)).findings.max);
  const min = useDoc((d) => formatLimits(formatOf(d)).findings.min);
  const id = frame?.id ?? "";
  if (index === n) {
    return (
      <li className="xe-add-finding" data-edit-only data-path={path}>
        <button
          type="button"
          className="xe-chip"
          disabled={n >= max}
          onClick={() => {
            store.listAdd(id, n);
            requestAnimationFrame(() => jumpTo(`${path}.${n}`));
          }}
        >
          <Plus aria-hidden size={14} strokeWidth={2.5} /> Add a finding
        </button>
      </li>
    );
  }
  const k = index + 1;
  return (
    <span className="xe-list-tools" data-edit-only>
      <button type="button" className="xe-tool xe-tool-sm" data-tip={`Move finding ${k} up`} aria-label={`Move finding ${k} up`} disabled={index === 0} onClick={() => store.listMove(id, index, index - 1)}>
        <ArrowUp aria-hidden size={14} strokeWidth={2.25} />
      </button>
      <button type="button" className="xe-tool xe-tool-sm" data-tip={`Move finding ${k} down`} aria-label={`Move finding ${k} down`} disabled={index === n - 1} onClick={() => store.listMove(id, index, index + 1)}>
        <ArrowDown aria-hidden size={14} strokeWidth={2.25} />
      </button>
      <button type="button" className="xe-tool xe-tool-sm" data-tip={`Remove finding ${k}`} aria-label={`Remove finding ${k}`} disabled={n <= min} onClick={() => store.listRemove(id, index)}>
        <X aria-hidden size={14} strokeWidth={2.25} />
      </button>
    </span>
  );
}

/**
 * The skills (decision 0026): the pills, each with a remove button over its corner, then the "Add a
 * skill" box (id skill-new), the size of a pill, at their end, in the flow and always drawn: on an
 * exhbt with no skills it is the block's placeholder. Enter makes what is typed a pill.
 */
function SkillsEdit() {
  const store = useStoreInternal();
  const { uiApi } = useRuntime();
  const skills = useDoc((d) => d.skills);
  const name = useDoc((d) => FORMAT_COPY[formatOf(d)].skills);
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (skills.some((s) => s.toLowerCase() === v.toLowerCase())) return setDraft("");
    if (skills.length >= LIMITS.skills.max) return uiApi.say(`Up to ${LIMITS.skills.max} skills.`);
    store.patchDoc((d) => ({ ...d, skills: [...d.skills, v] }));
    setDraft("");
    uiApi.say(`${v} added.`);
  };
  return (
    <ul aria-label={name} data-path="skills" className={SKILLS_LIST}>
      {skills.map((s, i) => (
        <li key={s} data-path={`skills.${i}`} className={cx(PILL, "relative xe-pill")}>
          {s}
          <button
            type="button"
            className="xe-pill-remove"
            data-edit-only
            aria-label={`Remove ${s}`}
            onClick={() => {
              store.patchDoc((d) => ({ ...d, skills: d.skills.filter((x) => x !== s) }));
              uiApi.say(`${s} removed.`);
              requestAnimationFrame(() => document.getElementById("skill-new")?.focus());
            }}
          >
            <X aria-hidden size={11} strokeWidth={3} />
          </button>
        </li>
      ))}
      <li className="contents">
        <input
          id="skill-new"
          data-edit-only="add-skill"
          className={cx(PILL, "xe-skill-new")}
          aria-label="Add a skill"
          placeholder="Add a skill"
          maxLength={LIMITS.skills.charsEach}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
      </li>
    </ul>
  );
}
