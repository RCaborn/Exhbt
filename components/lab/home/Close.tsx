"use client";

import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { MediaTheme } from "@astryxdesign/core/theme";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { demoHomeProjects, demoPortfolio } from "@/lib/exhbt";
import { portfolioHost } from "@/lib/hosts";
import { DEFAULT_THEME } from "@/lib/portfolio-themes";
import { Frame } from "../Frame";
import { LAB_PATH } from "../lab";
import { Address } from "../samples";
import { useHomeName } from "./HomeName";

/**
 * The closing band, the page's one ink section: the address as the loudest line (with the name
 * typed in the hero, if there is one), what it is for, the page's single action again, and (from a
 * laptop up) the page at that address rising from the foot of the band. Astryx
 * MediaTheme says "this is a dark ground", so the theme keeps the button mint and turns links and
 * the focus ring mint (the kit's "On ink").
 */
export function Close() {
  const me = useHomeName();
  return (
    <section aria-labelledby="hl-close-title" className="hl-close">
      <MediaTheme mode="dark">
        <div className="lab-content hl-close-inner">
          <Heading level={2} type="hero" id="hl-close-title">
            <span className="sr-only">A portfolio at </span>
            <Address name={me.username} nameClass="text-mint" />
          </Heading>
          <div className="hl-close-words">
            <Text as="p" display="block" type="large" color="secondary">
              One link for your CV, your LinkedIn and your email signature, and it opens on your work.
            </Text>
          </div>
          <div className="hl-close-act">
            <Button label="Start your portfolio" href={`${LAB_PATH}/app`} variant="primary" size="lg" />
            <Text type="supporting" color="secondary">
              Next: a free account, then your page. You pay only to put it online.
            </Text>
          </div>
          {/* Her page at that address, rising from the foot of the band (from a laptop up): the work the address opens on. */}
          <div className="hl-close-work">
            <Frame
              url={portfolioHost(me.username)}
              label={
                me.yours
                  ? `A preview of a portfolio home page with your name, ${me.name}, filled with made-up example projects`
                  : `${demoPortfolio.person.name}'s portfolio home page, a made-up example`
              }
              page="hl-close-page"
              crop="hl-close-crop"
            >
              <PortfolioHome
                person={me.person}
                theme={DEFAULT_THEME}
                projects={demoHomeProjects()}
                featuredId={null}
                sections={["featured"]}
                tiles={demoPortfolio.tiles}
              />
            </Frame>
          </div>
        </div>
      </MediaTheme>
    </section>
  );
}
