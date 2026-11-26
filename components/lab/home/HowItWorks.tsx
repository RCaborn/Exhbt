import { ArrowDown, ArrowRight } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { APP_HOST } from "@/lib/hosts";
import { Frame } from "../Frame";
import { Address, sample, SampleExhbt } from "../samples";
import { Film } from "./Film";
import { DRAFT_NOTE, FileChip, STEPS } from "./steps";

/**
 * "Start with the file you already have" (beat four): how an exhbt is made, from the file to a page
 * on the person's own address, shown as the real screens, not sketches: the file, the first draft
 * in the editor with its one line of what to check (an Astryx Banner above the real page, whose
 * ticks are still hollow), and the same page published at its address. Each step is larger than the one
 * before: the work grows as it goes.
 *
 * At maximal the same three steps are a film the scroll plays (Film.tsx); the still steps are
 * hidden there by CSS, and the film is hidden at the other levels.
 */
export function HowItWorks() {
  const [gp] = sample.exhbts;
  const file = gp!.doc.evidence?.label ?? "Dissertation.pdf";
  return (
    <section id="how" aria-labelledby="hl-how-title" className="hl-section hl-how">
      <div className="lab-content">
        <div className="hl-section-head">
          <Heading level={2} type="display-2" id="hl-how-title">
            Start with the file you already have.
          </Heading>
          <Text as="p" display="block" type="large" color="secondary">
            From the report on your laptop to a page on your own address. You check every word before anyone else sees it.
          </Text>
        </div>
      </div>

      <ol className="lab-content hl-steps" aria-label="How an exhbt is made">
        <li className="hl-step" data-step="file">
          <div className="hl-step-picture" aria-hidden>
            <FileChip name={file} />
          </div>
          <StepWords {...STEPS.file} />
        </li>
        <li className="hl-step-arrow" aria-hidden>
          <ArrowRight className="hl-arrow-across" size={22} strokeWidth={2} />
          <ArrowDown className="hl-arrow-down" size={22} strokeWidth={2} />
        </li>
        <li className="hl-step" data-step="draft">
          <div className="hl-step-picture">
            {/* The note is the editor's, so it is app chrome in the proposed theme, outside the person's page. */}
            <Banner status="info" title={DRAFT_NOTE.title} description={DRAFT_NOTE.description} />
            <Frame url={`${APP_HOST}/exhbts`} label="The first draft in the editor, its ticks still empty" page="hl-step-page">
              <SampleExhbt slug={gp!.slug} checked={false} className="p-6" />
            </Frame>
          </div>
          <StepWords {...STEPS.draft} />
        </li>
        <li className="hl-step-arrow" aria-hidden>
          <ArrowRight className="hl-arrow-across" size={22} strokeWidth={2} />
          <ArrowDown className="hl-arrow-down" size={22} strokeWidth={2} />
        </li>
        <li className="hl-step" data-step="live">
          <div className="hl-step-picture">
            <p className="hl-live-line">
              <StatusDot variant="success" label="Live" />
              <Text type="label">Live</Text>
            </p>
            <Frame url={sample.exhbtAddress(gp!.slug)} label="The same exhbt published at its address, its ticks filled" page="hl-step-page">
              <SampleExhbt slug={gp!.slug} className="p-6" />
            </Frame>
            <p className="hl-step-address">
              <Text type="display-3">
                <Address />
              </Text>
            </p>
          </div>
          <StepWords {...STEPS.live} />
        </li>
      </ol>
      <div className="lab-content hl-steps-note">
        <Text as="p" display="block" type="supporting">
          {sample.owner.name} and her project are made up.
        </Text>
      </div>

      <Film file={file} />
    </section>
  );
}

function StepWords({ title, body }: { title: string; body: string }) {
  return (
    <div className="hl-step-words">
      <Heading level={3}>{title}</Heading>
      <Text as="p" display="block" color="secondary">
        {body}
      </Text>
    </div>
  );
}
