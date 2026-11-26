import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Frame } from "../Frame";
import { Address, sample, SampleExhbt } from "../samples";
import { DRAFT_NOTE, FileChip, STEPS } from "./steps";

/**
 * "How it works" at maximal: a short film the scroll plays (the creative review's maximal level).
 * The section is several screens tall and its stage stays put while it scrolls; one named view
 * timeline on the section (home.css, "The film") moves the scenes: the file, large in the middle of
 * the window, is read (its bar fills) and gives way to the page, the page writes itself in reading order under its note on what to check, the note
 * goes, the ticks fill, and the address arrives with its Live dot. Scrolling back plays it back.
 *
 * Only at maximal, with motion allowed and scroll timelines supported. Anywhere else the still
 * steps (HowItWorks) are shown instead, so nobody gets a film frozen half way.
 */
export function Film({ file }: { file: string }) {
  const [gp] = sample.exhbts;
  return (
    <div className="hl-film">
      <div className="hl-film-stage">
        <div className="lab-content hl-film-grid">
          <ol className="hl-film-captions" aria-label="How an exhbt is made">
            {(["file", "draft", "live"] as const).map((k) => (
              <li key={k} data-scene={k}>
                <Heading level={3} type="display-3">
                  {STEPS[k].title}
                </Heading>
                <Text as="p" display="block" type="large" color="secondary">
                  {STEPS[k].body}
                </Text>
              </li>
            ))}
          </ol>
          <p className="hl-film-note">
            <Text type="supporting">{sample.owner.name} and her project are made up.</Text>
          </p>
          <div className="hl-film-screen">
            <div className="hl-film-window">
              {/* The upload, inside the window: the file large and centred, and a bar that fills as it is read. */}
              <div className="hl-film-file" aria-hidden>
                <FileChip name={file} />
                <span className="hl-film-read">
                  <ProgressBar label="Reading the file" value={100} isLabelHidden variant="success" />
                </span>
              </div>
              <Frame url={sample.exhbtAddress(gp!.slug)} label="An exhbt being made: drafted from the file, checked, then published" page="hl-film-page">
                <SampleExhbt slug={gp!.slug} className="p-6 sm:p-8" />
              </Frame>
              {/* The editor's note floats over the page: app chrome, so outside the person's page and in the proposed theme. */}
              <div className="hl-film-banner">
                <Banner status="info" title={DRAFT_NOTE.title} description={DRAFT_NOTE.description} elevation="med" />
              </div>
            </div>
            <p className="hl-film-address">
              <span className="hl-film-live">
                <StatusDot variant="success" label="Live" />
                <Text type="label">Live</Text>
              </span>
              <Text type="display-2">
                <Address />
              </Text>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
