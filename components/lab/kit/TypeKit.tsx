import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { portfolioHost } from "@/lib/hosts";
import { Address } from "../samples";
import { Compare, KitBlock, KitSection, Note } from "./parts";
import { TokenValue } from "./TokenValue";

const ADDRESS = portfolioHost("name");

/** What a line of type is called and how big it is here, read from the page. */
function Spec({ name, token, weight }: { name: string; token: string; weight: string }) {
  return (
    <p className="kit-spec">
      <b>{name}</b>
      <span>
        <TokenValue name={`--text-${token}-size`} kind="size" />
      </span>
      <span>{weight}</span>
    </p>
  );
}

/** Today's sizes are fixed in app/globals.css, so they are written here as they are there. */
function TodaySpec({ name, size }: { name: string; size: string }) {
  return (
    <p className="kit-spec">
      <b>{name}</b>
      <span>{size}</span>
    </p>
  );
}

const PROPOSED: { type: "display-1" | "display-2" | "display-3"; line: React.ReactNode }[] = [
  // A person's address, set as display type wherever it is claimed, shared or published.
  { type: "display-1", line: <Address /> },
  { type: "display-2", line: "One project, one page" },
  { type: "display-3", line: "Start with the file you already have" },
];

export function TypeKit() {
  return (
    <KitSection id="type" rule="One loud line a screen. Every screen opens on a display line, and nothing else on it is as large.">
      <KitBlock title="The display line">
        <div className="kit-stack" data-gap="lg">
          <Compare
            stacked
            todayLabel="Today, on Home only"
            proposedLabel="Proposed: the hero step, for Home"
            today={
              <div role="img" aria-label="Today's opening line on Home, 76 pixels on a wide screen" className="kit-specimen">
                <h1 className="display max-w-[21ch]">
                  A website of your own, <span className="highlight">built from your projects.</span>
                </h1>
                <TodaySpec name=".display" size="44 to 76px, on Home" />
              </div>
            }
            proposed={
              <div role="img" aria-label="The proposed opening line for Home" className="kit-specimen">
                <Heading level={3} type="hero">
                  A website of your own, <span className="highlight">built from your projects.</span>
                </Heading>
                <p className="kit-spec">
                  <b>Heading type=&quot;hero&quot;</b>
                  <span>
                    <TokenValue name="--exhbt-hero-size" kind="size" />
                  </span>
                  <span>semibold, set tight</span>
                </p>
              </div>
            }
          />
          <Note>
            Today every other page opens on the same 48px heading: &ldquo;Your exhbts&rdquo;, &ldquo;Account&rdquo; and &ldquo;Billing&rdquo; alike. Under
            Astryx untouched that heading would drop to 28px, and its largest display step is 48px in a regular weight.
          </Note>
        </div>
      </KitBlock>

      <KitBlock title="The scale">
        <Compare
          today={
            <div role="img" aria-label="Today's five type sizes" className="kit-specimens">
              <div className="kit-specimen">
                <h1>Your exhbts</h1>
                <TodaySpec name="h1" size="48px (36px on a phone)" />
              </div>
              <div className="kit-specimen">
                <h2 className="display-2">One project, one page</h2>
                <TodaySpec name=".display-2" size="44px, marketing only" />
              </div>
              <div className="kit-specimen">
                <h2>How it works</h2>
                <TodaySpec name="h2" size="32px" />
              </div>
              <div className="kit-specimen">
                <h3>Where to put your link</h3>
                <TodaySpec name="h3" size="22px" />
              </div>
              <div className="kit-specimen">
                <p>An exhbt is a piece of your work written up so an employer can read it in a minute and check it.</p>
                <TodaySpec name="Text" size="16px" />
              </div>
              <div className="kit-specimen">
                <p className="hint">Amara Okafor and her projects are made up.</p>
                <TodaySpec name="Caption" size="13px" />
              </div>
            </div>
          }
          proposed={
            <div role="img" aria-label="The proposed type scale" className="kit-specimens">
              {PROPOSED.map((p) => (
                <div key={p.type} className="kit-specimen">
                  <Heading level={3} type={p.type}>
                    {p.line}
                  </Heading>
                  <Spec name={`Heading type="${p.type}"`} token={p.type} weight="semibold" />
                </div>
              ))}
              <div className="kit-specimen">
                <Heading level={1} accessibilityLevel={3}>
                  Add an exhbt
                </Heading>
                <Spec name="Heading level 1" token="heading-1" weight="semibold" />
              </div>
              <div className="kit-specimen">
                <Heading level={2} accessibilityLevel={3}>
                  Where to put your link
                </Heading>
                <Spec name="Heading level 2" token="heading-2" weight="semibold" />
              </div>
              <div className="kit-specimen">
                <Heading level={3}>Can you trust it?</Heading>
                <Spec name="Heading level 3" token="heading-3" weight="semibold" />
              </div>
              <div className="kit-specimen">
                <Text as="p" display="block" type="large">
                  Turn your project work into a portfolio at {ADDRESS}.
                </Text>
                <Spec name={'Text type="large"'} token="large" weight="regular" />
              </div>
              <div className="kit-specimen">
                <Text as="p" display="block">An exhbt is a piece of your work written up so an employer can read it in a minute and check it.</Text>
                <Spec name="Text" token="body" weight="regular" />
              </div>
              <div className="kit-specimen">
                <Text as="p" display="block" type="label">
                  Your name
                </Text>
                <Spec name={'Text type="label"'} token="label" weight="semibold" />
              </div>
              <div className="kit-specimen">
                <Text as="p" display="block" type="supporting">
                  Amara Okafor and her projects are made up.
                </Text>
                <Spec name={'Text type="supporting"'} token="supporting" weight="regular" />
              </div>
            </div>
          }
        />
      </KitBlock>

      <KitBlock title="Text">
        <Compare
          today={
            <div className="kit-stack">
              <p className="text-lg text-graphite">
                That&rsquo;s an exhbt: a piece of your work written up so an employer can read it in a minute and check it.
              </p>
              <p>
                The title is the question the work set out to answer, and the line under it highlights{" "}
                <span className="highlight">the gap it fills</span>.{" "}
                <a href="#type" className="link">
                  What is an exhbt?
                </a>
              </p>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <Text as="p" display="block" type="large" color="secondary">
                That&rsquo;s an exhbt: a piece of your work written up so an employer can read it in a minute and check it.
              </Text>
              <Text as="p" display="block">
                The title is the question the work set out to answer, and the line under it highlights{" "}
                <span className="highlight">the gap it fills</span>. <Link href="#type">What is an exhbt?</Link>
              </Text>
              <Note>The highlighter stays the site&rsquo;s own flat mint stroke. Links are jade with a 2px underline, as now.</Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}
