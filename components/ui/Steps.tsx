"use client";

import { Step, Stepper } from "@astryxdesign/core/Stepper";

/** Astryx Stepper. Throws in development if given fewer than three steps (Astryx's own rule: three to seven). */
export function Steps({ label, steps, active, compact }: { label: string; steps: { label: string; note?: string }[]; active: number; compact?: boolean }) {
  if (process.env.NODE_ENV !== "production" && steps.length < 3) {
    throw new Error(`Steps needs at least three steps; got ${steps.length}. Use plain text for fewer.`);
  }
  return (
    <Stepper activeStep={active} label={label} density={compact ? "compact" : undefined}>
      {steps.map((s, i) => (
        <Step key={s.label} step={i} label={s.label} description={s.note} />
      ))}
    </Stepper>
  );
}
