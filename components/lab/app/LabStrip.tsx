"use client";

import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Popover } from "@astryxdesign/core/Popover";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import type { Progress } from "./FirstRun";
import { APP_SCREENS, appHref, type AppScreen, type AppShow } from "./screens";

type FirstRunControls = { progress: Progress; fill: () => void; add: () => void; reset: () => void };

/** The feedback states: the two toasts play now; the banner and the loading state are addresses. */
function Shows({ screen, show, onCopied, onSaved }: { screen: AppScreen; show: AppShow | null; onCopied: () => void; onSaved: () => void }) {
  const state = (id: AppShow, label: string) => {
    const on = show === id;
    return <Button label={on ? `${label}: showing. Press to clear it` : label} variant={on ? "secondary" : "ghost"} size="sm" href={appHref(screen, on ? null : id)} aria-current={on || undefined}>{label}</Button>;
  };
  return (
    <>
      <Button label="Link copied" variant="ghost" size="sm" onClick={onCopied} />
      <Button label="Saved" variant="ghost" size="sm" onClick={onSaved} />
      {state("failed", "A failed save")}
      {state("loading", "Loading")}
    </>
  );
}

/** First run's own lab controls: what she does on her page, without the real editor behind it. */
function FirstRunTools({ c }: { c: FirstRunControls }) {
  return (
    <>
      <Button label="Fill in her page" variant="ghost" size="sm" isDisabled={c.progress.page} onClick={c.fill} />
      <Button label="Add her first exhbt" variant="ghost" size="sm" isDisabled={c.progress.exhbt} onClick={c.add} />
      <Button label="Start again" variant="ghost" size="sm" isDisabled={!c.progress.page && !c.progress.exhbt} onClick={c.reset} />
    </>
  );
}

/**
 * The App screen's lab controls, under the lab bar and above the app's frame: which screen, and the
 * feedback states each screen can show. Lab chrome, drawn like the lab bar (mist, a dashed ink edge)
 * so it can't be taken for the product. It goes when the lab bar is folded away or left out, and
 * every screen is then reached through the app's own nav.
 *
 * On a wide window it is one row with the screen's note under it. Below that the screens stay as
 * tabs (Astryx TabList scrolls) and the rest, the note included, is one press away in a panel, as the
 * lab bar does.
 */
export function AppLabStrip({
  screen,
  show,
  onCopied,
  onSaved,
  firstRun,
}: {
  screen: AppScreen;
  show: AppShow | null;
  onCopied: () => void;
  onSaved: () => void;
  firstRun?: FirstRunControls;
}) {
  const note = APP_SCREENS.find((s) => s.id === screen)?.note;
  return (
    <aside aria-label="App screen, lab controls" className="app-lab">
      <div className="app-lab-row">
        <div className="app-lab-tabs">
          <TabList value={screen} onChange={() => {}} size="md">
            {APP_SCREENS.map((s) => (
              <Tab key={s.id} value={s.id} label={s.tab} href={appHref(s.id)} />
            ))}
          </TabList>
        </div>
        <div className="app-lab-wide">
          {firstRun && (
            <span className="app-lab-group">
              <FirstRunTools c={firstRun} />
            </span>
          )}
          <span className="app-lab-group">
            <Text type="supporting">Show</Text>
            <Shows screen={screen} show={show} onCopied={onCopied} onSaved={onSaved} />
          </span>
        </div>
        <div className="app-lab-narrow">
          <Popover
            label="Lab controls for this screen"
            alignment="end"
            padding={3}
            content={
              <div className="app-lab-panel">
                {note && (
                  <Text as="p" display="block" type="supporting">
                    {note}
                  </Text>
                )}
                {firstRun && (
                  <div className="app-lab-panel-group">
                    <Text type="label">Her first run</Text>
                    <FirstRunTools c={firstRun} />
                  </div>
                )}
                <div className="app-lab-panel-group">
                  <Text type="label">Show</Text>
                  <Shows screen={screen} show={show} onCopied={onCopied} onSaved={onSaved} />
                </div>
              </div>
            }
          >
            <Button label="Lab controls for this screen" variant="secondary" size="lg" endContent={<Icon icon="chevronDown" />}>
              Show
            </Button>
          </Popover>
        </div>
      </div>
      {note && (
        <p className="app-lab-note">
          <span>{note}</span>
        </p>
      )}
    </aside>
  );
}
