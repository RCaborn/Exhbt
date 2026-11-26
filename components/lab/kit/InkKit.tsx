import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { MediaTheme } from "@astryxdesign/core/theme";
import { Address, sample } from "../samples";
import { Compare, KitBlock, Note } from "./parts";

/**
 * Ink as a ground. Today it is one band on Home, written with the site's own classes. The
 * proposal keeps it rare (one band, at a finish) and makes it something Astryx components can
 * stand on: Astryx's MediaTheme says "this is a dark ground", and the theme's on-dark rules keep
 * the accent mint, outline the second button and turn links and the focus ring mint.
 */
export function InkKit() {
  const rest = sample.address.slice(sample.owner.username.length);
  return (
    <KitBlock title="On ink">
      <Compare
        stacked
        todayLabel="Today, Home's one ink band"
        today={
          <div className="kit-stack">
            <div className="kit-ink">
              <h2 className="display-2 text-white">A site that&rsquo;s all yours</h2>
              <p className="mt-6 font-[family-name:var(--font-display)] text-[clamp(1.75rem,8.2vw,6.5rem)] leading-none font-semibold tracking-[-0.045em] text-white [overflow-wrap:anywhere]">
                <span className="text-mint">{sample.owner.username}</span>
                {rest}
              </p>
              <p className="mt-8 max-w-[36rem] text-on-ink">
                One link for your CV, your LinkedIn and your email signature, and it opens on your work.{" "}
                <a href="#colour" className="font-semibold text-white underline decoration-graphite decoration-2 underline-offset-4 hover:decoration-mint">
                  Compare plans
                </a>
              </p>
            </div>
            <Note>Written by hand with the site&rsquo;s own classes. No Astryx component stands on ink today, and the band has no button.</Note>
          </div>
        }
        proposed={
          <div className="kit-stack">
            <div className="kit-ink">
              <MediaTheme mode="dark">
                <div className="kit-stack" data-gap="lg">
                  <Heading level={3} type="display-1">
                    <Address nameClass="text-mint" />
                  </Heading>
                  <div className="max-w-[36rem]">
                    <Text as="p" display="block" type="large" color="secondary">
                      One link for your CV, your LinkedIn and your email signature, and it opens on your work.{" "}
                      <Link href="#colour">Compare plans</Link>
                    </Text>
                  </div>
                  <div className="kit-row">
                    <Button label="Open your portfolio" variant="primary" />
                    <Button label="Copy the link" variant="secondary" />
                    <Button label="Not now" variant="ghost" />
                  </div>
                </div>
              </MediaTheme>
            </div>
            <Note>
              Astryx MediaTheme, set to dark, on an ink ground. The one button is still mint, the second is an outline, and links and the
              focus ring turn mint (press Tab to see it). Type, links and buttons go on ink; a card, a token, a banner or a field keeps
              its light ground and stays off it.
            </Note>
          </div>
        }
      />
    </KitBlock>
  );
}
