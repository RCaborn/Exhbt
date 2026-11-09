import { ArrowUp, Check } from "lucide-react";

/**
 * The two lists under a skill radar: "Level up next" (the biggest shortfalls) and "In the bag"
 * (at or above what the job asks). They carry the chart's meaning in words, so the radar can
 * stay free of numbers. The markers match the ones on the radar's labels.
 */

/** Arrow in an ink ring: a skill to level up. */
export function UpMarker() {
  return (
    <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-ink bg-surface">
      <ArrowUp size={10} strokeWidth={3} />
    </span>
  );
}

/** The green tick used for strengths elsewhere in the roadmap: a skill in the bag. */
export function BagMarker() {
  return (
    <span aria-hidden className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-ink bg-mint">
      <Check size={10} strokeWidth={3} />
    </span>
  );
}

export function SkillHighlights({ up, bag }: { up: string[]; bag: string[] }) {
  if (up.length === 0 && bag.length === 0) return null;
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {up.length > 0 && <Group title="Level up next" marker={<UpMarker />} skills={up} />}
      {bag.length > 0 && <Group title="In the bag" marker={<BagMarker />} skills={bag} />}
    </div>
  );
}

function Group({ title, marker, skills }: { title: string; marker: React.ReactNode; skills: string[] }) {
  return (
    <div className="rounded-[var(--radius)] bg-mist px-4 py-3.5">
      <p className="flex items-center gap-2 font-semibold">
        {marker}
        {title}
      </p>
      <ul aria-label={title} className="mt-1.5 space-y-0.5 pl-6">
        {skills.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
