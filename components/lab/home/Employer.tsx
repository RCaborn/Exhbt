import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Tick } from "@/components/ui/Tick";
import { CHECKS_GUIDE } from "@/components/brand/Seal";
import { Frame } from "../Frame";
import { exhbtOf, sample, SampleExhbt } from "../samples";

/** The project this beat compares: the forecasting one, so the page shows a second exhbt, not the first again. */
const SLUG = "ae-forecast";

/** What an employer sees, in the order the page gives it. The ticks' meaning is the employer guide's. */
const SEES = [
  "The question you asked and how you answered it.",
  "What you found, beside a graph with every value printed.",
  "The work itself, one click away.",
  "Ticks saying you confirmed it is accurate and your own, and that the work is attached. They don't grade it.",
];

/**
 * "A CV says it. An exhbt shows it." (beat three of the agreed story), with what an employer sees:
 * a CV's line about a project, as a CV would put it, beside that project's exhbt, drawn by the real
 * page. The CV is a plain document, flat, because it isn't the work; the exhbt is the one thing
 * raised. The ticks are the site's own, and their meaning is said the way the employer guide says
 * it: they show the checks ran, not that the results are true.
 */
export function Employer() {
  const e = exhbtOf(SLUG);
  return (
    <section id="employer" aria-labelledby="hl-employer-title" className="hl-section hl-employer">
      <div className="lab-content">
        <div className="hl-section-head">
          <Heading level={2} type="display-2" id="hl-employer-title">
            A CV says it. An exhbt shows it.
          </Heading>
          <Text as="p" display="block" type="large" color="secondary">
            A line on a CV or LinkedIn names the skill. An exhbt is the one-minute version of the work behind it, and an employer can check it.
          </Text>
        </div>
        <div className="hl-employer-grid">
          <figure className="hl-cv" aria-labelledby="hl-cv-caption">
            <p className="hl-cv-label" id="hl-cv-caption">
              <Text type="label">On a CV</Text>
            </p>
            <div className="hl-cv-sheet">
              <p className="hl-cv-name">{sample.owner.name}</p>
              <p className="hl-cv-head">Education</p>
              <p>{sample.owner.course}</p>
              <p className="hl-cv-head">Projects</p>
              <p className="hl-cv-line">Built a model in Python to forecast A&amp;E waiting times from open NHS data.</p>
            </div>
          </figure>
          <div className="hl-employer-work">
            <p className="hl-cv-label">
              <Text type="label">As an exhbt</Text>
            </p>
            <Frame
              url={sample.exhbtAddress(SLUG)}
              label={`The same project as an exhbt by ${sample.owner.name}, who is made up: ${e.doc.title}`}
              page="hl-employer-page"
            >
              <SampleExhbt slug={SLUG} className="p-6 sm:p-8" />
            </Frame>
          </div>
          <div className="hl-sees">
            <Heading level={3}>What an employer sees</Heading>
            <ul className="hl-sees-list">
              {SEES.map((s) => (
                <li key={s}>
                  <Tick size="sm" />
                  <Text>{s}</Text>
                </li>
              ))}
            </ul>
            <Text as="p" display="block" type="supporting">
              <Link href={CHECKS_GUIDE}>How employers read an exhbt</Link>
            </Text>
          </div>
        </div>
      </div>
    </section>
  );
}
