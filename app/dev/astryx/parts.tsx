import type { ReactNode } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";

/** One group of the dev page: a heading, one plain line on what the group is for, then the samples. */
export function Group({ id, title, purpose, children }: { id: string; title: string; purpose: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-14">
      <Heading level={2} id={`${id}-title`}>
        {title}
      </Heading>
      <Text as="p" display="block" color="secondary" type="large">
        {purpose}
      </Text>
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </section>
  );
}

/** A name over a sample, so a block says what it shows. */
export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <Heading level={3}>{title}</Heading>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Astryx on the left, the hand-built thing it replaces on the right. The two are labelled. */
export function Compare({ astryx, today }: { astryx: ReactNode; today: ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div data-col="astryx">
        <p className="mb-2 text-sm font-semibold text-graphite">Astryx</p>
        {astryx}
      </div>
      <div data-col="today">
        <p className="mb-2 text-sm font-semibold text-graphite">Today</p>
        {today}
      </div>
    </div>
  );
}

/** A row of controls that wraps. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}
