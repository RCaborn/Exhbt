"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PortfolioKind } from "@/lib/portfolio-kind";

/**
 * Which builder the switch serves this person at /portfolio, before `?builder=steps` (which only the address
 * knows): for `error.tsx`, which is drawn when the page itself failed and so cannot read it from the page.
 */
const Served = createContext<PortfolioKind>("steps");

export function ServedProvider({ kind, children }: { kind: PortfolioKind; children: ReactNode }): ReactNode {
  return <Served value={kind}>{children}</Served>;
}

export const useServed = (): PortfolioKind => useContext(Served);
