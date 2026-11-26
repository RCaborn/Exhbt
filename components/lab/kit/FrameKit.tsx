import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavItem } from "@astryxdesign/core/TopNav";
import { Logo } from "@/components/brand/Logo";
import { SiteHeader } from "@/components/site/SiteHeader";
import { LAB_PATH } from "../lab";
import { Compare, KitBlock, KitSection, Note } from "./parts";

/**
 * The top of the app's frame: today's header (the real SiteHeader, as a signed-in person has it)
 * beside Astryx's TopNav in the proposed theme, with the brand's own Logo in its heading slot.
 * The App screen builds the whole frame on it.
 */
export function FrameKit() {
  return (
    <KitSection id="frame" rule="One frame for every signed-in page: the same bar, the same content line under it, the same width.">
      <KitBlock>
        <Compare
          stacked
          today={
            <div className="kit-stack">
              <div className="kit-window">
                <SiteHeader signedIn phase2 portfolio="page" />
                <div className="mx-auto max-w-[40rem] px-4 py-8">
                  <h1>Account</h1>
                  <p className="mt-2 text-graphite">Each page sets its own width, so this line sits somewhere else on the next one.</p>
                </div>
              </div>
              <Note>The header mixes an outlined pill with plain links, and its edge (the logo) is never the content&rsquo;s edge.</Note>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <p className="kit-note kit-narrow-only">
                On a screen this narrow the bar&rsquo;s links fold into a drawer, which only the whole frame can show. Open it on a page of its own,
                below.
              </p>
              <div className="kit-window kit-wide-only">
                <TopNav
                  label="Exhbt, as a signed-in person has it"
                  heading={<Logo href="#frame" />}
                  startContent={
                    <>
                      <TopNavItem label="Your portfolio" href="#frame" isSelected />
                      <TopNavItem label="Roadmaps" href="#frame" />
                    </>
                  }
                  endContent={<Button label="Account" variant="ghost" size="sm" />}
                />
                <div className="kit-window-body">
                  <Heading level={3} type="display-2">
                    Your portfolio
                  </Heading>
                  <div className="mt-2">
                    <Text as="p" display="block" color="secondary">
                      The logo and this line share one left edge, on every page.
                    </Text>
                  </div>
                </div>
              </div>
              <div className="kit-row">
                <Button label="Open the frame on a page of its own" href={`${LAB_PATH}/kit/shell`} variant="secondary" />
              </div>
              <Note>
                Astryx TopNav, themed: white, a hairline, the page you are on in ink. On its own page it sits in Astryx&rsquo;s AppShell, where
                the links fold into a drawer on a phone. The App screen builds the whole frame.
              </Note>
            </div>
          }
        />
      </KitBlock>
    </KitSection>
  );
}
