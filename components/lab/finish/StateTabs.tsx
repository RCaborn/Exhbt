"use client";

import { Tab, TabList } from "@astryxdesign/core/TabList";
import { LAB_PATH } from "../lab";
import { FINISH_STATES, type FinishState } from "./states";

/**
 * The finish screen's states, as links: each state has its own address (?state=…), so a state can
 * be sent to someone and a screenshot can open it. A strip narrower than its tabs scrolls (Astryx).
 */
export function StateTabs({ current }: { current: FinishState }) {
  return (
    <TabList value={current} onChange={() => {}} hasDivider size="lg">
      {FINISH_STATES.map((s) => (
        <Tab key={s.id} value={s.id} label={s.tab} href={`${LAB_PATH}/finish?state=${s.id}`} />
      ))}
    </TabList>
  );
}
