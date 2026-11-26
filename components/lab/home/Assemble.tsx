import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { Frame } from "../Frame";
import { sample, SampleExhbt } from "../samples";

/** The parts of an exhbt, in the order the picture builds them (and an employer reads them). */
const PARTS = [
  { part: "question", name: "The question", body: "The title is what the work set out to answer. The line under it marks the gap it fills." },
  { part: "method", name: "How you did it", body: "Your steps as a flowchart, ending on the result." },
  { part: "found", name: "What you found", body: "A few short points beside the key graph, with every value printed." },
  { part: "proof", name: "The proof", body: "The work itself, a click away, and ticks for the checks that ran." },
] as const;

/**
 * "One project, one page" (beat two): one real exhbt, drawn by the product's own page
 * (ProjectView, through SampleExhbt), beside its four parts named in words.
 *
 * As the picture scrolls into view it puts itself together in reading order: the highlighter
 * draws under the gap in the question, the flowchart's boxes arrive one by one and the last turns
 * ink, the graph's line runs from before to after, and the ticks fill. Each part's name lights as
 * its part arrives. It is CSS alone (home.css, "The exhbt assembles"): one named view timeline on
 * the frame's wrapper, read by hooks the page already has (.xp-mark, .xp-flow, [data-part="graph"],
 * .xp-tick), so ProjectView isn't touched. At rest, under reduced motion, with Motion off and in a
 * browser without scroll timelines, it is the finished page.
 *
 * The whole page is in view at once at every width, zoomed like the portfolio pictures, so a phone
 * sees the flowchart, the graph and the ticks too, not a crop above them.
 */
export function Assemble() {
  const [gp] = sample.exhbts;
  return (
    <section id="one-page" aria-labelledby="hl-one-page-title" className="hl-section hl-assemble">
      <div className="lab-content hl-assemble-grid">
        <div className="hl-assemble-head">
          <Heading level={2} type="display-2" id="hl-one-page-title">
            One project, one page.
          </Heading>
          <Text as="p" display="block" type="large" color="secondary">
            That&rsquo;s an exhbt: a piece of your work written up so an employer can read it in a minute, and check it.
          </Text>
        </div>
        <div className="hl-assemble-parts">
          <dl className="hl-parts">
            {PARTS.map((p) => (
              <div key={p.part} className="hl-part" data-part-name={p.part}>
                <dt>
                  <Text type="label">{p.name}</Text>
                </dt>
                <dd>
                  <Text type="supporting">{p.body}</Text>
                </dd>
              </div>
            ))}
          </dl>
          <Text as="p" display="block" type="supporting">
            {sample.owner.name} and her projects are made up. <Link className="hl-hit" href={`/demo/${gp!.slug}`}>Open this exhbt</Link>
          </Text>
        </div>
        <div className="hl-assemble-work">
          <Frame
            url={sample.exhbtAddress(gp!.slug)}
            label={`An example exhbt by ${sample.owner.name}, who is made up: ${gp!.doc.title}`}
            page="hl-assemble-page"
          >
            <SampleExhbt slug={gp!.slug} className="p-6 sm:p-8" />
          </Frame>
        </div>
      </div>
    </section>
  );
}
