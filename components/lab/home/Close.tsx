"use client";

import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { MediaTheme } from "@astryxdesign/core/theme";
import { LAB_PATH } from "../lab";
import { Address } from "../samples";
import { useHomeName } from "./HomeName";

/**
 * The closing band, the page's one ink section: the address as the loudest line (with the name
 * typed in the hero, if there is one), what it is for, and the page's single action again. Astryx
 * MediaTheme says "this is a dark ground", so the theme keeps the button mint and turns links and
 * the focus ring mint (the kit's "On ink").
 */
export function Close() {
  const me = useHomeName();
  return (
    <section aria-labelledby="hl-close-title" className="hl-close">
      <MediaTheme mode="dark">
        <div className="lab-content hl-close-inner">
          <Heading level={2} type="display-1" id="hl-close-title">
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
              Free to start. You pay to put it online.
            </Text>
          </div>
        </div>
      </MediaTheme>
    </section>
  );
}
