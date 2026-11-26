import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Today } from "../LabFrame";

/** The kit's sections, in order: the page draws them and the rail lists them. */
export const KIT_SECTIONS = [
  { id: "type", label: "Type" },
  { id: "colour", label: "Colour" },
  { id: "buttons", label: "Buttons" },
  { id: "fields", label: "Fields" },
  { id: "choosing", label: "Tabs and choices" },
  { id: "cards", label: "Cards" },
  { id: "work", label: "The work, raised" },
  { id: "status", label: "Tokens and status" },
  { id: "overlays", label: "What floats" },
  { id: "empty", label: "Empty states" },
  { id: "progress", label: "Steps and waiting" },
  { id: "rings", label: "Focus and selection" },
  { id: "motion", label: "Motion" },
  { id: "frame", label: "The app's frame" },
] as const;
export type KitSectionId = (typeof KIT_SECTIONS)[number]["id"];

/** One section of the kit: its title, the rule it shows in one line, and its samples. */
export function KitSection({ id, rule, children }: { id: KitSectionId; rule: React.ReactNode; children: React.ReactNode }) {
  const section = KIT_SECTIONS.find((s) => s.id === id)!;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="kit-section">
      <div className="kit-section-head">
        <Heading level={2} type="display-3" id={`${id}-title`}>
          {section.label}
        </Heading>
        <Text as="p" display="block" type="large" color="secondary">
          {rule}
        </Text>
      </div>
      {children}
    </section>
  );
}

/** A group of samples inside a section, with a small title. */
export function KitBlock({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="kit-block">
      {title && (
        <div className="kit-block-title">
          <Heading level={3}>{title}</Heading>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Today beside proposed. `today` is drawn under the production theme with the site's own tokens
 * (the `Today` wrapper), so it is the live site's rendering, not a copy of it. `even` gives the two
 * the same width, for samples that need the room.
 */
export function Compare({
  today,
  proposed,
  even = false,
  stacked = false,
  todayLabel = "Today",
  proposedLabel = "Proposed",
}: {
  today: React.ReactNode;
  proposed: React.ReactNode;
  even?: boolean;
  /** One above the other at every width, for a sample that needs the whole column. */
  stacked?: boolean;
  todayLabel?: string;
  proposedLabel?: string;
}) {
  return (
    <div className="kit-compare" data-even={even || undefined} data-stacked={stacked || undefined}>
      <div className="kit-col" data-col="today">
        <p className="kit-col-label">{todayLabel}</p>
        <Today>{today}</Today>
      </div>
      <div className="kit-col" data-col="proposed">
        <p className="kit-col-label">{proposedLabel}</p>
        {proposed}
      </div>
    </div>
  );
}

/** A proposed-only sample, with the same label as a comparison's right-hand column. */
export function Proposed({ children, label = "Proposed" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="kit-col" data-col="proposed" data-solo>
      <p className="kit-col-label">{label}</p>
      {children}
    </div>
  );
}

/** A small grey line under a sample: what it is, or what today has instead. */
export function Note({ children }: { children: React.ReactNode }) {
  return <p className="kit-note">{children}</p>;
}
