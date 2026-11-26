"use client";

import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { appHref } from "./screens";

/**
 * The nav's second item. The roadmap keeps its own screens and isn't mocked up here, so rather than
 * a page that isn't found, the frame says so (as lab chrome) under the page's plain heading, which
 * sits on the logo's left edge as every page's first line does.
 */
export function Roadmaps() {
  return (
    <div className="lab-content app-roadmaps">
      <Heading level={1}>Roadmaps</Heading>
      <p className="app-lab-aside">
        <b>Lab</b>
        <span>The roadmap isn&rsquo;t part of this mock-up. Every signed-in page sits in this frame: the same bar, and its first line on the logo&rsquo;s left edge.</span>
      </p>
      <div className="app-row">
        <Button label="Back to your portfolio" variant="secondary" href={appHref("work")} />
      </div>
    </div>
  );
}
