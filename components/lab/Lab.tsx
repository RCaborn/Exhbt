"use client";

import "./lab.css";
import { memo, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Avatar } from "@/components/portfolio/Avatar";
import { Fact, ProjectView } from "@/components/portfolio/ProjectView";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { Button } from "@/components/ui/Button";
import { SCHEMA_VERSION, type ExhbtDoc } from "@/lib/exhbt/blocks";
import { demoOwner } from "@/lib/exhbt";
import { DEFAULT_THEME, PORTFOLIO_THEMES, type PhotoShape } from "@/lib/portfolio-themes";
import { Board } from "./Board";
import { ContextField } from "./ContextField";
import { AutoText, GrowContext } from "./fields";
import type { LabInitial, LabLook, Version } from "./options";
import { VersionContext } from "./version-context";
import { FLOW_ID, SAMPLE_NAMES, type LabDoc } from "./samples";
import { LabContext, LabStore, useLab, useLabStore, useRenderCount } from "./store";

const LOOK_NAMES: Record<LabLook, string> = { exhbt: "Exhbt", classic: "Classic", night: "Night" };
const VERSION_NAMES: Record<Version, string> = { mix: "Mix", a: "A, slide", b: "B, line" };
/** What each version does, said under the switch. */
const VERSION_NOTES: Record<Version, string> = {
  mix: "Mix: sections slide to make room. The flowchart, and the boxes in it, stay still and a line shows the place.",
  a: "A: everything slides to make room, sections and flow boxes alike.",
  b: "B: the page stays still and a line shows the place, for sections and flow boxes alike.",
};

/** The fictional demo person (lib/exhbt.ts). */
const OWNER = { name: demoOwner.name, bio: demoOwner.headline };
const WORK_HREF = "https://example.com/work";

/**
 * The editor lab (/lab/editor): a hands-on prototype of editing an exhbt as it looks, to decide
 * how drag and drop and typing on the page should feel before the real editor is designed
 * (docs/briefs/edit-on-page/drag-prototype.md). No sign-in, no database: three sample exhbts held
 * in memory, three looks, and two versions of dragging. Nothing is saved.
 */
export function Lab({ initial }: { initial: LabInitial }) {
  const [sample, setSample] = useState(initial.sample);
  const [look, setLook] = useState(initial.look);
  const [version, setVersion] = useState(initial.version);
  const [store] = useState(() => new LabStore(initial.sample));
  const [ready, setReady] = useState(false);
  const theme = PORTFOLIO_THEMES.find((t) => t.look === look) ?? DEFAULT_THEME;

  useEffect(() => setReady(true), []);
  // The choices are kept in the address, so a link opens the same sample, look and version.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("sample", sample);
    q.set("look", look);
    q.set("v", version);
    window.history.replaceState(null, "", `?${q}`);
  }, [sample, look, version]);

  return (
    <LabContext.Provider value={store}>
      <GrowContext.Provider value={initial.grow}>
       <VersionContext.Provider value={version}>
        {/* Clipped at its own edges, so a section carried past the foot of the page can't make the page longer. */}
        <div className="editor-touch overflow-clip" data-lab data-ready={ready || undefined}>
          <header className="border-b border-line bg-mist print:hidden">
            <div className="mx-auto flex max-w-[64rem] flex-wrap items-end gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
              <div className="min-w-[11rem] flex-1">
                <p className="font-display text-[1.375rem] leading-tight font-semibold tracking-[-0.02em]">Editor lab</p>
                <p className="mt-0.5 text-sm text-graphite">A try-out. Nothing here is saved.</p>
              </div>
              <Radios legend="Version" name="version" value={version} names={VERSION_NAMES} onChange={setVersion} />
              <Radios
                legend="Sample"
                name="sample"
                value={sample}
                names={SAMPLE_NAMES}
                onChange={(s) => {
                  setSample(s);
                  store.reset(s);
                }}
              />
              <Radios legend="Look" name="look" value={look} names={LOOK_NAMES} onChange={setLook} />
              <Button size="sm" onClick={() => store.reset(sample)}>
                Reset
              </Button>
              <p className="basis-full text-sm text-graphite" data-lab-version-note>
                {VERSION_NOTES[version]}
              </p>
            </div>
          </header>
          <div {...lookAttrs(theme)} style={themeStyle(theme)} className="min-h-svh bg-[var(--pf-ground)] text-[color:var(--pf-ink)]">
            <main id="main" className="mx-auto max-w-[64rem] px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
              {initial.read ? <Published shape={theme.photo} /> : <Page version={version} shape={theme.photo} />}
            </main>
          </div>
        </div>
       </VersionContext.Provider>
      </GrowContext.Provider>
    </LabContext.Provider>
  );
}

function Radios<T extends string>({ legend, name, value, names, onChange }: { legend: string; name: string; value: T; names: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[0.8125rem] font-semibold text-graphite">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {(Object.keys(names) as T[]).map((v) => (
          <label key={v} className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-[0.9375rem]">
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="size-4 accent-jade" />
            {names[v]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The exhbt page with its fields in place. The frame is ProjectView's (the same grid, sidebar and
 * main column, with the same classes), composed here because ProjectView has nowhere to put a
 * field or a draggable flowchart; `?read=1` draws the real one, and e2e/lab-editor.spec.ts checks
 * the two agree to the pixel.
 */
function Page({ version, shape }: { version: Version; shape: PhotoShape }) {
  return (
    <article data-exhbt-page className="xp @container/xp">
      <div className="grid gap-8 @3xl/xp:grid-cols-[13.5rem_minmax(0,1fr)] @3xl/xp:gap-9">
        <Aside shape={shape} />
        <div className="@container/main min-w-0">
          <Skills />
          <Title />
          <ContextField />
          <Board version={version} />
        </div>
      </div>
    </article>
  );
}

/** The sidebar, as ProjectView draws it. Nothing in it is edited in the lab. */
const Aside = memo(function Aside({ shape }: { shape: PhotoShape }) {
  const kind = useLab((d) => d.context);
  const whereWhen = useLab((d) => d.whereWhen);
  const work = useLab((d) => d.workLabel);
  useRenderCount("aside");
  const first = OWNER.name.split(/\s+/)[0]!;
  const checks = [
    { key: "confirmed", label: `Confirmed by ${first}`, done: true },
    ...(work ? [{ key: "source", label: "Source attached", done: true }] : []),
    { key: "checked", label: "Checked when published", done: false },
  ];
  return (
    <aside aria-label={`About ${first} and this work`} className="xp-aside min-w-0">
      <div className="xp-card flex items-center gap-4 p-4 @3xl/xp:flex-col @3xl/xp:items-stretch @3xl/xp:gap-0 @3xl/xp:p-5">
        <div className="xp-avatar shrink-0 @3xl/xp:mx-auto">
          <Avatar name={OWNER.name} photoUrl={null} size={88} shape={shape} />
        </div>
        <div className="min-w-0 @3xl/xp:mt-4">
          <p className="xp-name xp-display text-[1.5rem] leading-tight @3xl/xp:text-[1.625rem]">{OWNER.name}</p>
          <p className="xp-muted mt-1.5 text-[0.875rem] leading-snug">{OWNER.bio}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 px-1 @md/xp:grid-cols-2 @3xl/xp:mt-6 @3xl/xp:block @3xl/xp:px-5">
        {kind && <Fact term="What it is">{kind}</Fact>}
        {whereWhen && <Fact term="Where and when">{whereWhen}</Fact>}
        <Fact term="Can you trust it?" wide>
          <ul aria-label="Can you trust it?" className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 @3xl/xp:block @3xl/xp:space-y-1.5" data-checks>
            {checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2" data-done={c.done || undefined}>
                {c.done ? (
                  <span aria-hidden className="xp-tick mt-[0.2em] inline-flex size-[1.05rem] shrink-0 items-center justify-center rounded-full">
                    <Check size={11} strokeWidth={3.25} />
                  </span>
                ) : (
                  <span aria-hidden className="xp-tick-open mt-[0.2em] inline-flex size-[1.05rem] shrink-0 rounded-full" />
                )}
                <span className={c.done ? "" : "xp-muted font-medium"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </Fact>
      </dl>
      {work && (
        <div className="mt-6">
          <Button href={WORK_HREF} variant="primary" size="md" target="_blank" rel="nofollow ugc noopener" className="xp-work-button w-full" label={`See the work: ${work}`}>
            <span className="min-w-0">See the work: {work}</span>
          </Button>
        </div>
      )}
    </aside>
  );
});

const Skills = memo(function Skills() {
  const skills = useLab((d) => d.skills);
  useRenderCount("skills");
  if (!skills.length) return null;
  return (
    <ul aria-label="Skills used" className="flex flex-wrap gap-1 @2xl/main:justify-end">
      {skills.map((s) => (
        <li key={s} className="xp-pill px-2 py-[0.2rem] text-[0.78rem] font-medium">
          {s}
        </li>
      ))}
    </ul>
  );
});

/** The title, typed in place: the page's heading with a field for its words. */
const Title = memo(function Title() {
  const store = useLabStore();
  const title = useLab((d) => d.title);
  useRenderCount("title");
  return (
    <h1 className="xp-title xp-display mt-5 text-[clamp(2rem,7cqi,3.4rem)] leading-[1.02] text-balance">
      <AutoText label="Title" value={title} placeholder="Your question" onChange={(v) => store.setTitle(v)} />
    </h1>
  );
});

/** The lab's doc as a stored exhbt: the flowchart back in its fixed place, and no layout, so it is drawn as a case study. */
function asExhbt(d: LabDoc): ExhbtDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    title: d.title,
    context: d.context,
    whereWhen: d.whereWhen,
    skills: d.skills,
    gap: d.gap,
    flow: d.flow.map(({ step, detail }) => (detail ? { step, detail } : { step })),
    sections: d.order.filter((id) => id !== FLOW_ID).map((id) => d.sections[id]!),
    ...(d.workLabel ? { evidence: { kind: "link" as const, href: WORK_HREF, label: d.workLabel } } : {}),
  };
}

/** The same sample drawn by the real page component, to compare the lab's page against. */
function Published({ shape }: { shape: PhotoShape }) {
  const doc = useLab((d) => d);
  return <ProjectView doc={asExhbt(doc)} owner={{ ...OWNER, photoUrl: null, shape }} imageUrls={doc.imageUrls} evidenceUrl={doc.workLabel ? WORK_HREF : null} />;
}

