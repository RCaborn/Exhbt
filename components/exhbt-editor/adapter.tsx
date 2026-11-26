"use client";

import { memo, useContext, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { EditAdapter, ExtraSlot, InsertSlot, ListSlot, RichSlot, ShellTools } from "@/components/portfolio/page-ctx";
import { formatLimits, LIMITS } from "@/lib/exhbt/blocks";
import { FORMAT_COPY, formatOf } from "@/lib/exhbt/formats";
import { useRuntime } from "./context";
import { DraftToolsContext, MoreActions } from "./draft-tools";
import { InlineText } from "./fields/InlineText";
import { RichField } from "./fields/RichField";
import { TitleField } from "./fields/TitleField";
import { GraphExtras } from "./figures/GraphExtras";
import { ImageExtras } from "./figures/ImageExtras";
import { LinkExtras } from "./figures/LinkExtras";
import { useFlowEdit } from "./flow/FlowEdit";
import { Frame, useFieldPath, useFrame } from "./Frame";
import { ADD_SKILL_BUTTON, ADD_SKILL_CHIP, PILL, SKILLS_LIST } from "./geometry";
import { Insert } from "./Insert";
import { labelAt } from "./labels";
import { WorkButton } from "./sheets/WorkButton";
import { useDoc, useSection, useStoreInternal } from "./store";
import { jumpTo } from "./jump";

/*
 * The editor's adapter (decision 0026, "One page, one renderer"): one stable object whose functions
 * return the editing version of each slot the page parts call. Each returns a component and nothing
 * else (they are called while a part draws, inside its lists), so the hooks are in the components.
 * Every element this adds that the visitor's page lacks carries data-edit-only, and none takes room
 * but what 0026 puts in the flow in the editor only: the placeholders, each image's description field
 * and the "Add a skill" box. A part's title (decision 0032) is the heading itself with a field in it; a
 * cleared one keeps its place as a placeholder, "Add a title".
 */

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// The other owners' plugs, memoised here: when a move draws the shell again, the work button and a "+" whose place and
// name have not changed do not draw again. The "+" is named for the item at its place ("Add a section before Graph 1"),
// which it reads from the store when it draws, so the wrapper draws it again whenever that name changes.
const MemoWork = memo(WorkButton);
const MemoInsert = memo(function PlaceInsert({ at, end }: InsertSlot) {
  useDoc((d) => (end ? null : labelAt(d, at)));
  return <Insert at={at} end={end} />;
});

export function useAdapter(): EditAdapter {
  const flow = useFlowEdit();
  // The flowchart's slots are K's hook; the adapter stays one object whatever that hook returns.
  const flowRef = useRef(flow);
  flowRef.current = flow;
  return useMemo<EditAdapter>(
    () => ({
      text: (o) => <InlineText {...o} />,
      rich: (o) => (CAPTION.test(o.path) ? <CaptionField {...o} /> : <RichField {...o} />),
      title: (o) => <TitleField {...o} />,
      item: (o) => <Frame {...o} />,
      insert: (o) => <MemoInsert {...o} />,
      extra: (o) => <Extra {...o} />,
      list: (o) => <ListControls {...o} />,
      flow: {
        list: (o) => flowRef.current.list(o),
        box: (o) => flowRef.current.box(o),
        tools: (o) => flowRef.current.tools(o),
        add: (o) => flowRef.current.add(o),
      },
      skills: () => <SkillsEdit />,
      work: () => <MemoWork />,
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
const ShellToolbar = memo(function ShellToolbar({ block }: ShellTools) {
  const rt = useContext(DraftToolsContext);
  if (!rt?.init) return null;
  return (
    <div className="xe-shell-tools" data-edit-only data-block={block}>
      <MoreActions block={block} />
    </div>
  );
});

/** An image's caption: the page parts cannot know the picture's number, so its name ("Image 2 caption") comes from its section here. */
const CAPTION = /^sections\.(-?\d+)\.caption$/;
const CaptionField = memo(function CaptionField(o: RichSlot) {
  const frame = useFrame();
  const path = useFieldPath(o.path);
  const at = frame && frame.index >= 0 ? frame.index : Number(path.match(CAPTION)?.[1] ?? 0);
  const n = useDoc((d) => d.sections.slice(0, at + 1).filter((s) => s.kind === "image").length);
  return <RichField {...o} label={`Image ${Math.max(1, n)} caption`} />;
});

const Extra = memo(function Extra(o: ExtraSlot) {
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
});

/** The aim or hypothesis switch, over the aim's top edge (decision 0026). */
const AimSwitch = memo(function AimSwitch({ sectionId }: { sectionId: string }) {
  const store = useStoreInternal();
  const s = useSection(sectionId);
  const heading = s?.kind === "aim" ? (s.heading ?? "aim") : "aim";
  return (
    <span className="xe-above" data-edit-only role="group" aria-label="Aim or hypothesis">
      {(["aim", "hypothesis"] as const).map((h) => (
        <button
          key={h}
          type="button"
          className="xe-chip"
          aria-pressed={heading === h}
          // The switch names the heading. A title the person typed over it would hide what the switch does, so pressing it puts
          // the layout's heading back, as one step Undo takes back, the title with it. The one already on changes nothing.
          onClick={() =>
            store.patch(
              sectionId,
              (x) => {
                if (x.kind !== "aim" || (x.heading ?? "aim") === h) return x;
                const next = { ...x, heading: h };
                delete next.title;
                return next;
              },
              h === "aim" ? "switch to Aim" : "switch to Hypothesis",
            )
          }
        >
          {h === "aim" ? "Aim" : "Hypothesis"}
        </button>
      ))}
    </span>
  );
});

/** A finding's controls (move up, move down, remove), drawn over its line; at `index === n`, "Add a finding", in the gap below the last. Any finding can be removed: how many there are is a suggestion (decision 0032). */
const ListControls = memo(function ListControls({ path: given, index, n }: ListSlot) {
  const frame = useFrame();
  const path = useFieldPath(given);
  const store = useStoreInternal();
  const max = useDoc((d) => formatLimits(formatOf(d)).findings.max);
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
      <button type="button" className="xe-tool xe-tool-sm" data-tip={`Remove finding ${k}`} aria-label={`Remove finding ${k}`} onClick={() => store.listRemove(id, index)}>
        <X aria-hidden size={14} strokeWidth={2.25} />
      </button>
    </span>
  );
});

/**
 * The skills (decision 0026): the pills, each with a remove button over its corner, then the "Add a
 * skill" box (id skill-new), the size of a pill, at their end, in the flow and always drawn: on an
 * exhbt with no skills it is the block's placeholder. Enter makes what is typed a pill.
 */
const SkillsEdit = memo(function SkillsEdit() {
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
          // What is typed is kept when the person moves on, so it is not lost with the box (data-safety-4).
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
        {/* A phone keyboard often has no comma: on a touch screen the box has an Add button, a 44px press that adds no height (geometry.ts). */}
        <button
          type="button"
          data-edit-only="add-skill-button"
          className={ADD_SKILL_BUTTON}
          onClick={() => {
            add();
            document.getElementById("skill-new")?.focus({ preventScroll: true });
          }}
        >
          <span className={ADD_SKILL_CHIP}>
            Add
            <span className="sr-only"> skill</span>
          </span>
        </button>
      </li>
    </ul>
  );
});
