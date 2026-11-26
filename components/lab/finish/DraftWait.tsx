"use client";

import { useEffect, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Text } from "@astryxdesign/core/Text";
import { BrowserFrame } from "@/components/home/BrowserFrame";
import { Tick } from "@/components/ui/Tick";
import { PersonPage } from "../LabFrame";
import type { FinishWords } from "./words";

/**
 * The drafting view's own steps and when each starts, in seconds after the person presses the
 * button: DRAFT_STEPS in app/(app)/exhbts/new/DraftForm.tsx, copied because the lab changes no
 * existing file (promoting this screen should export them from there). The last step stays until
 * the answer arrives, which takes "about 20 seconds" in the real view's own words.
 */
const STEPS = [
  { label: "Reading your files", at: 0 },
  { label: "Finding the numbers", at: 6 },
  { label: "Writing your exhbt", at: 13 },
] as const;
/** When the lab's answer arrives. A real one arrives when it arrives. */
const ARRIVES = 20;

/**
 * The page's shape while it is drafted: Astryx Skeletons laid out as the exhbt page lays itself out
 * (the sidebar, the title, the context line, the flowchart, a graph). Each part comes up when the
 * step that makes it begins: the sidebar and the file when the files are read, the flowchart and the
 * graph when the numbers are found, the words when it is written. It never shows content it doesn't
 * have; the file's name is real (the person chose it). The shimmer is stilled (finish.css): nothing loops.
 */
function Shape({ step, file }: { step: number; file: string | null }) {
  const part = (n: number) => ({ "data-part-step": n, "data-on": step >= n || undefined });
  return (
    <div className="fin-shape" aria-hidden>
      <div className="fin-shape-aside" {...part(0)}>
        <Skeleton width={64} height={64} index={0} />
        <Skeleton width="70%" height={18} index={1} />
        <Skeleton width="90%" height={12} index={2} />
        {file && <span className="fin-shape-file">{file}</span>}
      </div>
      <div className="fin-shape-main">
        <div className="fin-shape-words" {...part(2)}>
          <Skeleton width="92%" height={30} index={3} />
          <Skeleton width="64%" height={30} index={4} />
          <Skeleton width="80%" height={14} index={5} />
        </div>
        <div className="fin-shape-flow" {...part(1)}>
          {[6, 7, 8, 9, 10].map((i) => (
            <Skeleton key={i} height={54} index={i} />
          ))}
        </div>
        <div className="fin-shape-found" {...part(1)}>
          <div className="fin-shape-words" {...part(2)}>
            <Skeleton width="50%" height={18} index={11} />
            <Skeleton width="100%" height={12} index={12} />
            <Skeleton width="86%" height={12} index={13} />
          </div>
          <Skeleton height={104} index={14} />
        </div>
      </div>
    </div>
  );
}

/**
 * The wait while the first draft is written (about 20 seconds), which today is a bar on a grey panel.
 * The steps are the real view's, said in words and ticked as they pass (Astryx Stepper, the site's
 * own tick), with no percentage, because nothing measures one. The page takes shape in its frame
 * beside them. When the draft arrives it replaces the shape and assembles in reading order (not at
 * restrained), with one line saying what to do next. "Skip the wait" and "Play it again" are the lab's.
 */
export function DraftWait({ words, draftPage }: { words: FinishWords; draftPage: React.ReactNode }) {
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    setStep(0);
    setArrived(false);
    const timers = [
      ...STEPS.slice(1).map((s, i) => window.setTimeout(() => setStep(i + 1), s.at * 1000)),
      window.setTimeout(() => setArrived(true), ARRIVES * 1000),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [run]);

  const said = arrived
    ? "Here's your first draft. We wrote it from your files and nothing else. Check each number, then publish."
    : `Step ${step + 1} of ${STEPS.length}: ${STEPS[step]!.label}.`;

  return (
    <section className="fin-stage lab-content" aria-labelledby="fin-stage-title">
      <h2 id="fin-stage-title" className="sr-only">
        Add an exhbt, while the draft is written
      </h2>
      <div className="fin-replay">
        {!arrived && <Button label="Skip the wait" variant="ghost" size="sm" onClick={() => setArrived(true)} />}
        <Button label="Play it again" variant="secondary" size="sm" onClick={() => setRun((n) => n + 1)} />
      </div>
      {/* In reading order for a phone (the line, the page, then the steps or what to do next); on a
          wide window the page moves to the right of the words (finish.css, grid areas). */}
      <div className="fin-window fin-wait" data-arrived={arrived || undefined}>
        <div className="fin-wait-top">
          <p role="status" className="sr-only">
            {said}
          </p>
          {arrived ? (
            <Heading level={3} type="display-3">
              Here&rsquo;s your first draft.
            </Heading>
          ) : (
            <>
              <Heading level={3} type="display-3">
                Drafting your exhbt
              </Heading>
              <Text as="p" display="block" color="secondary">
                From {words.evidence ?? "your files"}. This usually takes about 20 seconds. Stay on this page.
              </Text>
            </>
          )}
        </div>
        <div className="fin-wait-work" data-lab-frame>
          <BrowserFrame url={`${words.appHost}/exhbts/new`}>
            <div className="fin-wait-crop">
              {arrived ? (
                <PersonPage className="fin-wait-page">{draftPage}</PersonPage>
              ) : (
                <Shape step={step} file={words.evidence} />
              )}
            </div>
          </BrowserFrame>
        </div>
        <div className="fin-wait-rest">
          {arrived ? (
            <>
              <Banner status="info" title="We wrote it from your files and nothing else." description="Check each number, then publish." />
              <div>
                <Button label="Open it in the editor" variant="primary" size="lg" href={words.editorHref} />
              </div>
            </>
          ) : (
            <Stepper activeStep={step} orientation="vertical" label="Drafting your exhbt">
              {STEPS.map((s, i) => (
                <Step key={s.label} step={i} label={s.label} indicator={i < step ? <Tick /> : "number"} />
              ))}
            </Stepper>
          )}
        </div>
      </div>
    </section>
  );
}
