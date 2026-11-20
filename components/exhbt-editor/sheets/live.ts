"use client";

import { atom, useAtom } from "../atom";
import { useEnv } from "../context";

/*
 * Whether this exhbt is live and at what address, as the sheets know it. The page's props are the
 * state at load; publishing and unpublishing change it, so the sheet (and the top bar, once it reads
 * this) shows the change without a reload. `setLive` is the one call that tells everyone. When G's
 * live status lands in context.ts, publishing calls that instead and this file shrinks to a re-export.
 */
type Live = { id: string; status: "draft" | "published"; slug: string | null };
const state = atom<Live | null>(null);

export function setLive(id: string, status: Live["status"], slug: string | null) {
  state.set({ id, status, slug });
}

export function useLive(): { status: "draft" | "published"; slug: string | null } {
  const env = useEnv();
  const s = useAtom(state);
  return s && s.id === env.id ? { status: s.status, slug: s.slug } : { status: env.status, slug: env.slug };
}
