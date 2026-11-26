import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Preview } from "@/components/home/Preview";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { Frame } from "@/components/lab/Frame";
import { ButtonsKit, CardsKit, ChoosingKit, FieldsKit } from "@/components/lab/kit/ControlsKit";
import { FrameKit } from "@/components/lab/kit/FrameKit";
import { KitRail } from "@/components/lab/kit/KitRail";
import { LevelFacts } from "@/components/lab/kit/LevelFacts";
import { MotionKit } from "@/components/lab/kit/MotionKit";
import { OverlaysKit } from "@/components/lab/kit/OverlaysKit";
import { Compare, KitBlock, KitSection, Note, Proposed } from "@/components/lab/kit/parts";
import { EmptyKit, ProgressKit, RingsKit, StatusKit } from "@/components/lab/kit/StatusKit";
import { TokenValue } from "@/components/lab/kit/TokenValue";
import { TypeKit } from "@/components/lab/kit/TypeKit";
import { sample, SampleExhbt, SamplePortfolio } from "@/components/lab/samples";
import { labGate, labMetadata } from "@/components/lab/server";
import "@/components/lab/kit/kit.css";

export const generateMetadata = labMetadata("Kit");

const FIXED = [
  { name: "Mint", token: "--color-mint", role: "Go, live and checked. One mint button a screen, the tick, the dot on Live.", className: "bg-mint text-ink" },
  { name: "Jade", token: "--color-jade", role: "Mint that has to be read: links, the focus ring, the word Live.", className: "bg-jade text-white" },
  { name: "Ink", token: "--color-ink", role: "Text, chrome and the chosen one of several. At a finish, a whole band.", className: "bg-ink text-white" },
  { name: "White", token: "--color-surface", role: "Every main ground. Forms lie on it, flat.", className: "border border-line bg-surface text-ink" },
] as const;

const GREYS = [
  { name: "Graphite", token: "--color-graphite", role: "Secondary text" },
  { name: "Slate", token: "--color-slate", role: "Captions" },
  { name: "Field", token: "--color-field", role: "A field's edge" },
  { name: "Line", token: "--color-line", role: "Hairlines" },
  { name: "Mist", token: "--color-mist", role: "The second ground" },
  { name: "Wash", token: "--color-wash", role: "Behind Live and checked" },
] as const;

/**
 * The kit: the proposed theme ("the voice") on one page, with the site as it is today beside it
 * wherever there is a today. It is Rory's first look at the voice, and the specification for the
 * real theme: every figure on it is read from the stylesheets, not typed.
 */
export default function LabKit() {
  labGate();
  const [featured] = sample.exhbts;
  return (
    <main id="main" className="kit">
      <header className="kit-top">
        <div className="kit-top-words">
          <Heading level={1} type="display-1">
            The voice, on one page.
          </Heading>
          <Text as="p" display="block" type="large" color="secondary">
            Exhbt&rsquo;s colours and typefaces don&rsquo;t change. What changes is how loudly they speak, and what they speak for: a person&rsquo;s own
            work, shown large. In each section below, the site as it is today is on the left and the proposal is on the right.
          </Text>
        </div>
        {/* The product in the first screen: her portfolio, drawn by the real page, in the proposed frame. */}
        <Frame
          className="kit-top-work"
          url={sample.address}
          label={`${sample.owner.name}'s portfolio home page, an example: her name, her photo's place, her intro and her best piece of work`}
          crop="max-h-[22rem] sm:max-h-[26rem] lg:max-h-[30rem]"
          page="[zoom:0.5] sm:[zoom:0.6] lg:[zoom:0.56]"
        >
          <SamplePortfolio />
        </Frame>
        <LevelFacts />
      </header>

      <div className="kit-body">
        <aside className="kit-rail">
          <KitRail />
        </aside>
        <div>
          <TypeKit />

          <KitSection id="colour" rule="The four colours are fixed. The proposal is about where each is spent, and mint is spent least.">
            <KitBlock>
              <div className="kit-swatches">
                {FIXED.map((c) => (
                  <div key={c.name} className={`kit-swatch ${c.className}`}>
                    <b>{c.name}</b>
                    <span>
                      <TokenValue name={c.token} />
                    </span>
                    <span>{c.role}</span>
                  </div>
                ))}
              </div>
              <div className="kit-greys">
                {GREYS.map((c) => (
                  <div key={c.name} className="kit-grey">
                    <i style={{ background: `var(${c.token})` }} />
                    <b>{c.name}</b>
                    <span>
                      <TokenValue name={c.token} /> · {c.role}
                    </span>
                  </div>
                ))}
              </div>
            </KitBlock>
          </KitSection>

          <ButtonsKit />
          <FieldsKit />
          <ChoosingKit />
          <CardsKit />

          <KitSection id="work" rule="Only the work is raised. A person's page in its frame is the one thing in the flow of a page that casts a shadow.">
            <KitBlock title="An exhbt, as an employer opens it">
              <Compare
                even
                today={
                  <div className="kit-stack">
                    <div className="pattern-viewfinder min-w-0 rounded-[24px] p-3 sm:p-5">
                      <Preview url={sample.exhbtAddress(featured!.slug)} label={`Today's picture of an example exhbt by ${sample.owner.name}`} crop="max-h-[30rem]" className="bg-surface p-4 sm:p-6 lg:[zoom:0.45]">
                        <ProjectView
                          doc={featured!.doc}
                          owner={{ name: sample.owner.name, photoUrl: null, bio: sample.owner.headline, homeHref: "/demo" }}
                          evidenceUrl="#"
                          checkedOn={featured!.checkedOn}
                          headingLevel="h2"
                        />
                      </Preview>
                    </div>
                    <Note>The same soft shadow is in more than thirty files today, form cards among them, so the work doesn&rsquo;t stand out from a form.</Note>
                  </div>
                }
                proposed={
                  <div className="kit-stack">
                    <div className="kit-ground" data-ground="work">
                      <Frame url={sample.exhbtAddress(featured!.slug)} label={`An example exhbt by ${sample.owner.name}, in the proposed frame`} crop="max-h-[30rem]" page="lg:[zoom:0.45]">
                        <SampleExhbt slug={featured!.slug} className="p-4 sm:p-6" />
                      </Frame>
                    </div>
                    <Note>
                      The site&rsquo;s real BrowserFrame round the real page, on a plain ground so its shadow can be read. The frame takes the
                      theme&rsquo;s container radius and its high shadow, which nothing else in the flow of a page uses. The page inside is the
                      person&rsquo;s own and isn&rsquo;t restyled.
                    </Note>
                  </div>
                }
              />
            </KitBlock>
            <KitBlock title="A portfolio, in the look its owner chose">
              <Proposed>
                <div className="kit-stack">
                  <Frame url={sample.address} label={`${sample.owner.name}'s portfolio home page in the Night look, in the proposed frame`} crop="max-h-[34rem]" page="[zoom:0.6] sm:[zoom:0.75]">
                    <SamplePortfolio look="night" />
                  </Frame>
                  <Note>
                    {sample.owner.name}, her address and her projects are made up. A look can leave the brand&rsquo;s colours and typefaces; the frame
                    round it is always the site&rsquo;s.
                  </Note>
                </div>
              </Proposed>
            </KitBlock>
          </KitSection>

          <StatusKit />
          <OverlaysKit />
          <EmptyKit
            picture={
              <Frame url={sample.exhbtAddress(featured!.slug)} label="An example exhbt, small" crop="max-h-[11rem]" page="[zoom:0.28]" className="w-[17rem]">
                <SampleExhbt slug={featured!.slug} className="p-6" />
              </Frame>
            }
          />
          <ProgressKit />
          <RingsKit />
          <MotionKit />
          <FrameKit />
        </div>
      </div>
    </main>
  );
}
