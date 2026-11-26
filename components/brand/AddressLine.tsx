import type { ReactNode } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { portfolioHost } from "@/lib/hosts";

/*
 * A person's address as display type (decision 0033, the first of the six): the name, then the host.
 * Drawn on the theme's display steps (--text-display-1..3, Bricolage at 600) and in the brand face, which a
 * portfolio look never changes (--font-brand, as the Logo does). Only the two colours are set here:
 * "on-ink": the name in mint, the rest white. "on-white": the name in jade, the rest ink.
 * The host comes from lib/hosts.ts, never from a typed string. A name USERNAME_RE would refuse is drawn as
 * given: checking it is the caller's job. A long name (up to 30 characters) breaks at its hyphens, and anywhere
 * as a last resort, so it never runs off a phone; a line may also break before the host.
 */
const STEP = { 1: "display-1", 2: "display-2", 3: "display-3" } as const;
const FACE = "font-[family-name:var(--font-brand)] [overflow-wrap:anywhere]";

export function AddressLine({ username, tone = "on-white", size = 2, as = "p" }: { username: string; tone?: "on-ink" | "on-white"; size?: 1 | 2 | 3; as?: "p" | "h2" | "h3" }): ReactNode {
  const host = portfolioHost(username);
  // The host is "<name>.<apex>": the name is drawn in colour and the rest follows it.
  const rest = host.slice(username.length);
  const nameColour = tone === "on-ink" ? "text-mint" : "text-jade";
  const restColour = tone === "on-ink" ? "text-white" : "text-ink";
  const words = (
    <>
      <span className={nameColour}>{username}</span>
      <wbr />
      <span className={restColour}>{rest}</span>
    </>
  );
  if (as === "p") {
    return (
      <Text as="p" display="block" type={STEP[size]} color="inherit" className={FACE}>
        {words}
      </Text>
    );
  }
  return (
    <Heading level={as === "h2" ? 2 : 3} type={STEP[size]} className={FACE}>
      {words}
    </Heading>
  );
}
