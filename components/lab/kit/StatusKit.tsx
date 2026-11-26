"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Seal } from "@/components/brand/Seal";
import { Tick } from "@/components/ui/Tick";
import { Compare, KitBlock, KitSection, Note, Proposed } from "./parts";

export function StatusKit() {
  return (
    <KitSection id="status" rule="Mint means go, live and checked. Status is said in words first, then in mint and jade; red is for an error and nothing else.">
      <KitBlock title="Tokens and dots">
        <Compare
          today={
            <div className="kit-stack">
              <div className="kit-row">
                <span className="chip">Live</span>
                <span className="chip bg-mist text-graphite">Draft</span>
                <span className="chip bg-mist text-graphite">Preview only</span>
                <span className="chip">Coming soon</span>
              </div>
              <div className="kit-row">
                <Tick />
                <Seal date="12 March 2026" asLink={false} />
              </div>
              <Note>The tick and the seal are the brand&rsquo;s own and don&rsquo;t change.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <div className="kit-row">
                <Token label="Live" color="green" icon={<StatusDot variant="success" label="Live" />} />
                <Token label="Draft" icon={<StatusDot variant="neutral" label="Draft" />} />
                <Token label="Preview only" />
                <Token label="Coming soon" color="green" />
              </div>
              <div className="kit-row">
                <Token label="Python" size="sm" />
                <Token label="pandas" size="sm" />
                <Token label="Logistic regression" size="sm" />
                <Token label="Trial design" size="sm" />
              </div>
              <div className="kit-row">
                <Tick />
                <Seal date="12 March 2026" asLink={false} />
              </div>
              <Note>
                Astryx Token and StatusDot. Live is jade on wash with a mint dot; a draft is grey. Astryx&rsquo;s other token colours
                (blue, purple, orange and the rest) all come out grey in this theme, so none can leak in.
              </Note>
            </div>
          }
        />
      </KitBlock>

      <KitBlock title="Banners">
        <Compare
          today={
            <div className="kit-stack" data-gap="sm">
              {/* The editor's teammates strip and the gate's error, with the classes each has today. */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[16px] border border-line bg-surface px-4 py-3">
                <p className="text-sm">Worked on this with other people? Add them as teammates.</p>
                <a href="#status" className="link text-sm font-semibold text-ink">
                  Add teammates
                </a>
              </div>
              <p className="rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">We couldn&rsquo;t read Dissertation.pdf.</p>
              <Note>Each is a box drawn by hand where it is used, with its own corners, padding and edge.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack" data-gap="sm">
              <Banner status="info" title="Here's your first draft." description="We wrote it from your files and nothing else. Check each number, then publish." />
              <Banner status="success" title="Saved." description="Your changes are on your draft." />
              <Banner status="warning" title="Two numbers need checking." description="We couldn't find them in your files." endContent={<Button label="Show me" size="sm" />} />
              <Banner status="error" title="We couldn't read Dissertation.pdf." description="Try a PDF or a Word file." />
              <Note>Astryx Banner. Information is ink on mist, a warning is ink with an edge (the brand has no amber), an error is the one red.</Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}

export function EmptyKit({ picture }: { picture: React.ReactNode }) {
  return (
    <KitSection id="empty" rule="An empty screen shows the thing that will fill it, and has one button: the next step.">
      <KitBlock>
        <Compare
          today={
            <div className="kit-stack">
              <p className="text-graphite">Nothing here yet. Your first exhbt will show here.</p>
              <Note>The whole empty state of the exhbts page: one grey sentence. The way to add one is a card further up the page.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <div className="kit-ground" data-ground="line">
                <EmptyState
                  headingLevel={3}
                  icon={picture}
                  title="Your best project goes here"
                  description="One project, written up as a page an employer can read in a minute. Start with a file you already have."
                  actions={<Button label="Add an exhbt" variant="primary" />}
                />
              </div>
              <Note>Astryx EmptyState. Its picture is a real page in the site&rsquo;s frame (the example, marked as made up wherever it is shown), not a grey icon.</Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}

const STEPS = ["Your page", "First exhbt", "Online"];

export function ProgressKit() {
  const [step, setStep] = useState(1);
  return (
    <KitSection id="progress" rule="Progress is true or it isn't shown. A step is ticked because it happened; a wait shows the shape of what is coming.">
      <KitBlock title="Steps">
        <Compare
          today={
            <div className="kit-stack">
              <div>
                <p className="text-sm font-semibold text-graphite">Step 2 of 3</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden>
                  <span className="h-1.5 rounded-full bg-jade" />
                  <span className="h-1.5 rounded-full bg-jade" />
                  <span className="h-1.5 rounded-full bg-wash" />
                </div>
              </div>
              <Note>A counter over three bars. The steps have no names.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <Stepper activeStep={step} label="Getting your portfolio online" onStepClick={setStep}>
                {STEPS.map((label, i) => (
                  // A finished step takes the site's own tick; the others keep Astryx's number.
                  <Step key={label} step={i} label={label} indicator={i < step ? <Tick /> : "number"} />
                ))}
              </Stepper>
              <Note>Astryx Stepper. Done is the site&rsquo;s mint tick, now is ink, to come is grey. Press a step to move it.</Note>
            </div>
          }
        />
      </KitBlock>

      <KitBlock title="Waiting">
        <Compare
          today={
            <div className="kit-stack">
              <div className="h-2 overflow-hidden rounded-full bg-wash" role="img" aria-label="Today's loading bar">
                <span className="block h-full w-1/3 rounded-full bg-jade" />
              </div>
              <Note>For about 20 seconds while a draft is written: a bar on a grey panel, and three lines of text that change.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <div className="kit-skeleton" role="img" aria-label="An exhbt taking shape while its draft is written">
                <Skeleton width="68%" height={28} index={0} />
                <Skeleton width="92%" height={14} index={1} />
                <div className="kit-skeleton-flow">
                  <Skeleton height={56} index={2} />
                  <Skeleton height={56} index={3} />
                  <Skeleton height={56} index={4} />
                  <Skeleton height={56} index={5} />
                </div>
                <Skeleton width="100%" height={112} index={6} />
              </div>
              <ProgressBar label="Reading Dissertation.pdf" value={62} hasValueLabel />
              <Note>Astryx Skeleton, laid out as the page that is coming, and ProgressBar for a wait with a known length.</Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}

/** The rings, drawn standing on each ground, and the live ones to try with the Tab key. */
export function RingsKit() {
  return (
    <KitSection id="rings" rule="Never blue. Focus is one jade ring, clear of the control, on every ground; a chosen thing takes an ink edge.">
      <KitBlock title="The focus ring">
        <Compare
          stacked
          todayLabel="Today"
          proposedLabel="Proposed, on each ground"
          today={
            <div className="kit-stack">
              <div className="kit-rings-today">
                <span className="kit-ring-today" data-ring="site">
                  A plain link or field
                </span>
                <span className="kit-ring-today" data-ring="astryx">
                  The main button
                </span>
              </div>
              <Note>
                Two rings, measured on the home page. A plain link or field gets the site&rsquo;s own: jade, with a white and ink halo. An
                Astryx button gets Astryx&rsquo;s, in the accent colour, which is mint: 1.5:1 on white, and next to nothing round a mint
                button. Astryx&rsquo;s selection ring, unthemed, is blue.
              </Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <div className="kit-rings">
                <div className="kit-ring-ground" data-ground="white">
                  <span className="kit-ring" data-on="white">
                    On white
                  </span>
                  <span>Jade, 5.6:1</span>
                </div>
                <div className="kit-ring-ground" data-ground="mist">
                  <span className="kit-ring" data-on="white">
                    On mist
                  </span>
                  <span>Jade, 5.2:1</span>
                </div>
                <div className="kit-ring-ground" data-ground="mint">
                  <span className="kit-ring" data-on="mint">
                    On mint
                  </span>
                  <span>Jade, 3.6:1</span>
                </div>
                <div className="kit-ring-ground" data-ground="ink">
                  <span className="kit-ring" data-on="ink">
                    On ink
                  </span>
                  <span>Mint, 12.4:1</span>
                </div>
              </div>
              <Text as="p" display="block" type="supporting">
                One ring, from the theme&rsquo;s focus tokens: 3px, 2px clear of the control. Press Tab anywhere on this page to see it on the real
                controls. A field shows focus on its own edge instead: jade, with a mint halo (see Fields).
              </Text>
            </div>
          }
        />
      </KitBlock>
      <KitBlock title="Chosen">
        <Proposed>
          <div className="kit-stack">
            <Text as="p" display="block" type="supporting">
              Ink marks the chosen one of several: the tab&rsquo;s underline, the segment, a card&rsquo;s edge (all in Tabs and choices). Mint marks
              what is done: a ticked box, a switch that is on, a step that is finished.
            </Text>
          </div>
        </Proposed>
      </KitBlock>
    </KitSection>
  );
}
