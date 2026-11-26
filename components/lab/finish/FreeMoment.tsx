"use client";

import { useEffect, useRef } from "react";
import { Button } from "@astryxdesign/core/Button";
import { DialogHeader } from "@astryxdesign/core/Dialog";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import type { FinishWords } from "./words";

/**
 * The finish on Free (decision 0031, step 7): a Free account can't publish, so the exhbt is saved as a
 * draft on the person's portfolio that only they can see. The moment says so plainly, shows their
 * page in the frame with one display line, and offers the upgrade once, saying what it gives (their
 * own address, and publishing). Nothing here says the exhbt is out in the world, because it isn't:
 * no ink, no ticks filling, no address of theirs (Free can't claim one), and no countdown.
 * The reasons and the plan's name and price are the product's own (lib/plan-rules.ts, lib/entitlements.ts).
 *
 * The parts are in reading order for a phone (the line, the page, the offer, the way back); on a wide
 * window the page moves to the right of the words (finish.css, grid areas).
 */
export function FreeMoment({ words, freePage, onClose }: { words: FinishWords; freePage: React.ReactNode; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("h2[tabindex]")?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={root} className="fin-free">
      <div className="fin-free-top">
        <DialogHeader title="Saved to your portfolio" hasDivider={false} />
        <p className="fin-free-line">Only you can see it.</p>
        <Text as="p" display="block" type="large" color="secondary">
          It&rsquo;s on your portfolio as a draft. {words.free.reason}
        </Text>
      </div>
      <div className="fin-free-work">{freePage}</div>
      <div className="fin-free-offer">
        <Text as="p" display="block" type="label">
          What {words.free.plan} adds
        </Text>
        <ul className="fin-free-gives">
          <li>Your own address, like {words.free.exampleHost}</li>
          <li>Publishing, so anyone you send the link to can open it</li>
        </ul>
        <div className="fin-free-actions">
          <Button label={words.free.upgrade} variant="primary" size="lg" href="/pricing" />
          <Link href="/pricing">Compare plans</Link>
        </div>
      </div>
      <div className="fin-free-back">
        <Button label="Back to your portfolio" variant="ghost" icon={<Icon icon="chevronLeft" />} href={words.portfolioHref} />
      </div>
      <span className="fin-close fin-close-any">
        <IconButton label="Close" icon={<Icon icon="close" />} variant="ghost" onClick={onClose} />
      </span>
    </div>
  );
}
