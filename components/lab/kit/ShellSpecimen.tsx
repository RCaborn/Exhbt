"use client";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavItem } from "@astryxdesign/core/TopNav";
import { Logo } from "@/components/brand/Logo";
import { LAB_PATH } from "../lab";

/**
 * Astryx's AppShell in the proposed theme, on a page of its own (an AppShell is a whole page: it
 * draws the skip link and the main landmark itself, so a page that uses it has no `<main>` of its
 * own). It is here to show the theme on the shell, the top bar, the banner slot and, below 768px,
 * the drawer the bar's links fold into. The App screen builds the real frame.
 *
 * The content sits in `.lab-content` (lab.css): the theme's content width and gutter, which the
 * themed top bar pads itself to, so the logo and the page's first line share a left edge.
 */
export function ShellSpecimen() {
  const here = `${LAB_PATH}/kit/shell`;
  return (
    <AppShell
      height="auto"
      variant="surface"
      banner={<Banner container="section" status="info" title="This is a specimen of the app's frame, not a page of the app." />}
      topNav={
        <TopNav
          label="Main"
          heading={<Logo href={here} />}
          startContent={
            <>
              <TopNavItem label="Your portfolio" href={here} isSelected />
              <TopNavItem label="Roadmaps" href={here} />
            </>
          }
          endContent={<Button label="Account" variant="ghost" size="sm" />}
        />
      }
    >
      <div className="lab-content grid gap-4 py-12 sm:py-16">
        <Heading level={1} type="display-1">
          Your portfolio
        </Heading>
        <Text as="p" display="block" type="large" color="secondary">
          The logo above and this line share one left edge. Every signed-in page would sit in this frame, at this width.
        </Text>
        <div>
          <Button label="Back to the kit" href={`${LAB_PATH}/kit#frame`} variant="secondary" />
        </div>
      </div>
    </AppShell>
  );
}
