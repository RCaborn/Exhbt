"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Popover } from "@astryxdesign/core/Popover";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { isLevel, LAB_PATH, LAB_SCREENS, LEVELS, type Level } from "./lab";
import { useLab } from "./LabFrame";

const NAME: Record<Level, string> = { restrained: "Restrained", confident: "Confident", maximal: "Maximal" };

/** The lab's screens as links. The one you are on is marked for assistive tech and drawn pressed. */
function Screens() {
  const pathname = usePathname();
  return (
    <nav aria-label="Lab screens" className="lab-bar-links">
      {LAB_SCREENS.map((s) => {
        const here = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return <Button key={s.href} label={s.label} href={s.href} variant={here ? "secondary" : "ghost"} aria-current={here ? "page" : undefined} />;
      })}
    </nav>
  );
}

/** The level switch and the motion switch. `fill` stretches the level switch across a narrow panel. */
function Switches({ fill = false }: { fill?: boolean }) {
  const lab = useLab();
  return (
    <>
      <SegmentedControl label="Level" value={lab.level} onChange={(v) => isLevel(v) && lab.setLevel(v)} size="lg" layout={fill ? "fill" : "hug"}>
        {LEVELS.map((l) => (
          <SegmentedControlItem key={l} value={l} label={NAME[l]} />
        ))}
      </SegmentedControl>
      <Switch label="Motion off" value={lab.motion === "off"} onChange={(off) => lab.setMotion(off ? "off" : "on")} labelSpacing={fill ? "spread" : "hug"} />
    </>
  );
}

/**
 * The lab bar: a slim strip above every lab screen that says this is not the live site, links the
 * four screens, and holds the two switches every screen reads (the level, and Motion off, which
 * forces the resting state). On a wide window everything is in the strip; below that the links and
 * switches are one press away in a panel, so a phone loses one row and no more.
 * It can be folded away to a small button, to see a screen as a visitor would.
 */
export function LabBar() {
  const lab = useLab();
  if (lab.bar === "none") return null;
  if (lab.bar === "hidden") {
    return (
      <div className="lab-bar-fold">
        <Button label="Show the lab bar" variant="ink" elevation="med" onClick={() => lab.setBar("shown")}>
          Lab
        </Button>
      </div>
    );
  }
  const fold = () => lab.setBar("hidden");
  return (
    <aside aria-label="Design lab" className="lab-bar">
      <div className="lab-bar-row">
        <p className="lab-bar-title">
          <Link href={LAB_PATH} className="lab-tag">
            <span>Design lab</span>
          </Link>
          <span>not the live site</span>
        </p>
        <div className="lab-bar-wide">
          <Screens />
          <Switches />
          <IconButton label="Fold the lab bar away" tooltip="Fold the lab bar away" icon={<Icon icon="close" />} variant="ghost" onClick={fold} />
        </div>
        <div className="lab-bar-narrow">
          <Popover
            label="Lab controls"
            alignment="end"
            padding={3}
            content={
              <div className="lab-bar-panel">
                <Screens />
                <Switches fill />
                <Button label="Fold the lab bar away" variant="secondary" onClick={fold} width="100%" />
              </div>
            }
          >
            <Button label={`Lab controls. Level: ${NAME[lab.level]}`} variant="secondary" endContent={<Icon icon="chevronDown" />}>
              {NAME[lab.level]}
            </Button>
          </Popover>
        </div>
      </div>
    </aside>
  );
}
