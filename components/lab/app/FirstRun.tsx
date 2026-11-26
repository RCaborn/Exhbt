"use client";

import { Plus } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Text } from "@astryxdesign/core/Text";
import { Tick } from "@/components/ui/Tick";
import { Frame } from "../Frame";
import { FailedSave } from "./Feedback";
import type { AppWords } from "./words";

/** Which of the strip's last two steps are done. The first (her account) is done by signing up. */
export type Progress = { page: boolean; exhbt: boolean };

/**
 * Her page as the real PortfolioHome draws it, in the default look, at each point of her first
 * run (drawn on the server): `"00"` her name only, `"10"` with a line about her, `"01"` with her
 * first exhbt in the band, `"11"` both. Then the example exhbt the empty state pictures.
 */
export type FirstRunArt = { pages: Record<"00" | "10" | "01" | "11", React.ReactNode>; example: React.ReactNode };

const STEPS = [
  { label: "Account", description: "Done when you signed up" },
  { label: "Your page", description: "A line about you, a photo, a look" },
  { label: "First exhbt", description: "One project, written up" },
] as const;

/**
 * First run (decision 0031, steps 1 to 4, with decision 0033's ticked first step): a new person's
 * first screen after signing up. Her own page with her name already on it, a strip of what to do
 * next with the account step ticked (it is true), and the empty state for her first exhbt with the
 * screen's one mint button.
 *
 * The page is drawn in the site's frame as a stand-in for the one-page editor other agents are
 * building; this screen is the chrome round it. She is on Free with no address, so the frame's bar
 * shows the app's own address for the page, and nothing on the screen says "live".
 */
export function FirstRun({
  words,
  art,
  progress,
  onFill,
  onAdd,
  failed,
  loading,
}: {
  words: AppWords;
  art: FirstRunArt;
  progress: Progress;
  /** She finishes her page: a line about her, a photo, a look (in the lab, at once). */
  onFill: () => void;
  /** Her first exhbt arrives (in the lab, at once). */
  onAdd: () => void;
  failed: boolean;
  loading: boolean;
}) {
  const done = 1 + Number(progress.page) + Number(progress.exhbt);
  // The step she is on: the first one not done. With all three done, past the last.
  const active = !progress.page ? 1 : !progress.exhbt ? 2 : 3;
  const page = art.pages[`${Number(progress.page)}${Number(progress.exhbt)}` as "00"];
  const left = 3 - done;
  return (
    <>
      <section className="app-strip" aria-labelledby="app-strip-title" data-done={left === 0 || undefined}>
        <div className="lab-content app-strip-row">
          <div className="app-strip-title">
            <Heading level={2} id="app-strip-title">
              Your portfolio in three steps
            </Heading>
            <Text as="p" display="block" type="supporting">
              {left === 0 ? "All three done." : `Step ${active + 1} of 3: ${STEPS[Math.min(active, 2) as 0 | 1 | 2].label.toLowerCase()}`}
            </Text>
          </div>
          {loading ? (
            <div className="app-strip-steps">
              <Skeleton height={44} radius="rounded" index={0} />
            </div>
          ) : (
            <div className="app-strip-steps">
              <Stepper activeStep={active} label="Your portfolio in three steps" density="compact" horizontalOptions={{ minimumStepWidth: 168, collapsedVariant: "hiddenLabel" }}>
                {STEPS.map((s, i) => {
                  const isDone = i === 0 || (i === 1 && progress.page) || (i === 2 && progress.exhbt);
                  return <Step key={s.label} step={i} label={s.label} description={s.description} indicator={isDone ? <Tick label="Done" /> : "number"} />;
                })}
              </Stepper>
            </div>
          )}
        </div>
      </section>

      <div className="lab-content app-first">
        <div className="app-first-grid">
          <div className="app-first-now">
            <div className="app-head app-first-head">
              <Heading level={1} type="display-1">
                This is your portfolio, {words.person.first}.
              </Heading>
              <div className="app-lead">
                <Text as="p" display="block" type="large" color="secondary">
                  It&rsquo;s the website an employer opens. Only you can see it for now.
                </Text>
              </div>
            </div>

            {failed && (
              <FailedSave
                screen="first-run"
                title="We couldn’t save your page."
                description="Your changes are still here. Check your connection, then try again."
                onRetry={() => {}}
              />
            )}

            <div className="app-first-page">
            {loading ? (
              <div className="app-skel-frame" role="img" aria-label="Your page, loading">
                <Skeleton height={40} radius={0} index={0} />
                <div className="app-skel-hero">
                  <Skeleton width={112} height={112} radius="rounded" index={1} />
                  <div className="app-skel-lines">
                    <Skeleton width="30%" height={14} index={2} />
                    <Skeleton width="80%" height={56} index={3} />
                    <Skeleton width="55%" height={16} index={4} />
                  </div>
                </div>
              </div>
            ) : (
              <Frame
                url={words.ownerUrl}
                label={`${words.person.name}'s page as she has it so far${progress.page ? ", with a line about her" : ": her name and nothing else"}${progress.exhbt ? ", and her first exhbt" : ""}`}
                page="[zoom:0.56] sm:[zoom:0.62] lg:[zoom:0.6]"
                // With her first exhbt on it the page is shown whole, so the exhbt can be seen where it landed.
                crop={progress.exhbt ? "" : "max-h-[24rem] sm:max-h-[28rem] lg:max-h-[30rem]"}
              >
                {page}
              </Frame>
            )}
            </div>
          </div>

          <div className="app-first-next">
            {loading ? (
              <div className="app-skel-empty" role="img" aria-label="Loading">
                <Skeleton width="70%" height={150} index={5} />
                <Skeleton width="60%" height={22} index={6} />
                <Skeleton width="85%" height={14} index={7} />
                <Skeleton width={210} height={48} radius="rounded" index={8} />
              </div>
            ) : progress.exhbt ? (
              // The next step, whichever it is: her page if it isn't finished; then, on Free, putting it online.
              <div className="app-first-done" key={progress.page ? "all" : "exhbt"}>
                <span className="app-first-done-tick">
                  <Tick size="lg" />
                </span>
                <Heading level={2}>{progress.page ? "All three done." : "Your first exhbt is on your page."}</Heading>
                <Text as="p" display="block" color="secondary">
                  {progress.page ? words.firstRun.onlineNote : "Next, a line about you, a photo and a look, typed on the page itself."}
                </Text>
                <div className="app-row">
                  {progress.page ? (
                    <Button label="See plans" variant="primary" href="/pricing" target="_blank" />
                  ) : (
                    <Button label="Finish your page" variant="primary" onClick={onFill} />
                  )}
                </div>
                {!progress.page && (
                  <Text as="p" display="block" type="supporting">
                    {words.firstRun.draftNote}
                  </Text>
                )}
              </div>
            ) : (
              <>
                <EmptyState
                  headingLevel={2}
                  icon={
                    <span className="app-example">
                      <Frame url={words.exampleUrl} label="An example exhbt, made up" crop="max-h-[9.5rem] sm:max-h-[11rem]" page="[zoom:0.3] sm:[zoom:0.34]">
                        {art.example}
                      </Frame>
                      <span className="app-example-tag">Made-up example</span>
                    </span>
                  }
                  title="Your best project goes here"
                  description="One project as a page an employer reads in a minute and can check. We draft it from a file you already have; you check every word."
                  actions={<Button label="Add your first exhbt" variant="primary" size="lg" icon={<Icon icon={Plus} />} onClick={onAdd} />}
                />
                <Text as="p" display="block" type="supporting">
                  {words.firstRun.draftNote}
                </Text>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
