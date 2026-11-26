"use client";

import { useRouter } from "next/navigation";
import { Selector } from "@astryxdesign/core/Selector";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { LAB_PATH } from "../lab";
import { FINISH_STATES, type FinishState } from "./states";

/**
 * The finish screen's states, as links: each state has its own address (?state=…), so a state can
 * be sent to someone and a screenshot can open it. On a wide window they are Astryx tabs; on a
 * phone, where five tabs would scroll behind arrows and clip their names, one Astryx Selector that
 * goes to the chosen state. Both are drawn and CSS shows one (finish.css), so the server's HTML and
 * the browser's agree.
 */
export function StateTabs({ current }: { current: FinishState }) {
  const router = useRouter();
  const href = (id: string) => `${LAB_PATH}/finish?state=${id}`;
  return (
    <>
      <div className="fin-tabs-wide">
        <TabList value={current} onChange={() => {}} hasDivider size="lg">
          {FINISH_STATES.map((s) => (
            <Tab key={s.id} value={s.id} label={s.tab} href={href(s.id)} />
          ))}
        </TabList>
      </div>
      <div className="fin-tabs-narrow">
        <Selector
          label="Which moment"
          options={FINISH_STATES.map((s) => ({ value: s.id, label: s.tab }))}
          value={current}
          onChange={(v) => v && v !== current && router.push(href(v))}
          size="lg"
        />
      </div>
    </>
  );
}
