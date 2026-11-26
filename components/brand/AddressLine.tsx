import type { ReactNode } from "react";
import { portfolioHost } from "@/lib/hosts";

/*
 * A person's address as display type (decision 0033, the first of the six): the name, then the host.
 * "on-ink": the name in mint, the rest white. "on-white": the name in jade, the rest ink.
 * The host comes from lib/hosts.ts, never from a typed string. A name USERNAME_RE would refuse is drawn as
 * given: checking it is the caller's job.
 */
const SIZE = { 1: "text-[clamp(2rem,6vw,4rem)]", 2: "text-[clamp(1.5rem,4vw,2.5rem)]", 3: "text-[clamp(1.125rem,2.5vw,1.5rem)]" } as const;

export function AddressLine({ username, tone = "on-white", size = 2, as: Tag = "p" }: { username: string; tone?: "on-ink" | "on-white"; size?: 1 | 2 | 3; as?: "p" | "h2" | "h3" }): ReactNode {
  const host = portfolioHost(username);
  // The host is "<name>.<apex>": the name is drawn in colour and the rest follows it.
  const name = username;
  const rest = host.slice(username.length);
  const nameColour = tone === "on-ink" ? "text-mint" : "text-jade";
  const restColour = tone === "on-ink" ? "text-white" : "text-ink";
  return (
    <Tag className={`font-display font-bold leading-tight tracking-tight [overflow-wrap:break-word] ${SIZE[size]}`}>
      <span className={`whitespace-nowrap ${nameColour}`}>{name}</span>
      {/* A line may break before the host, never inside the name. */}
      <wbr />
      <span className={restColour}>{rest}</span>
    </Tag>
  );
}
