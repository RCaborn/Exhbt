"use client";

import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { appHref } from "./screens";

/**
 * The nav's second item. The roadmap keeps its own screens and isn't mocked up here, so rather than
 * a page that isn't found, the frame says so and shows what every page shares: the bar above and
 * this line, on the same left edge as the logo.
 */
export function Roadmaps() {
  return (
    <div className="lab-content app-roadmaps">
      <Heading level={1}>Roadmaps</Heading>
      <div className="app-lead">
        <Text as="p" display="block" type="large" color="secondary">
          The roadmap isn&rsquo;t part of this mock-up. Every signed-in page sits in this frame: the same bar, and its first line on the
          logo&rsquo;s left edge.
        </Text>
      </div>
      <div className="app-row">
        <Button label="Back to your portfolio" variant="secondary" href={appHref("work")} />
      </div>
    </div>
  );
}
