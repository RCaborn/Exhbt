"use client";

import { createContext, use, useMemo, useState } from "react";
import type { PortfolioPerson } from "@/components/portfolio/PortfolioPage";
import { demoPortfolio } from "@/lib/exhbt";
import { nameState, type NameState } from "./address";

/**
 * The name typed into Home's hero, shared with the other pictures of her page further down (the
 * eight looks, the closing band). Nothing is sent or stored: it lives in this page's memory and is
 * gone on reload.
 *
 * Until a name gives an address lib/hosts.ts would accept, every picture shows the made-up person
 * exactly as the live home page does (`demoPortfolio.person`), so a promoted page with an empty
 * field draws what the golden copies hold.
 */
type HomeName = NameState & {
  /** What is in the field, as typed. */
  typed: string;
  setTyped: (typed: string) => void;
  /** The person the pictures show: the made-up one, or her page with the typed name and its address. */
  person: PortfolioPerson;
  /** The address's name part: the typed one when there is one, hers otherwise. */
  username: string;
  /** True when the pictures carry the typed name. */
  yours: boolean;
};

const Ctx = createContext<HomeName | null>(null);

export function HomeNameProvider({ children }: { children: React.ReactNode }) {
  const [typed, setTyped] = useState("");
  const value = useMemo<HomeName>(() => {
    const state = nameState(typed);
    const base = demoPortfolio.person;
    const yours = state.address !== null;
    return {
      ...state,
      typed,
      setTyped,
      yours,
      username: state.address ?? base.username,
      person: yours ? { ...base, name: state.name, username: state.address } : base,
    };
  }, [typed]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useHomeName(): HomeName {
  const v = use(Ctx);
  if (!v) throw new Error("useHomeName() only works inside HomeNameProvider (app/lab/design/home).");
  return v;
}
