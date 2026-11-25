"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EditorKind } from "@/lib/editor-kind";

/**
 * Which editor the switch serves on this route (lib/editor-kind.ts), handed by the route's layout to its error
 * page (error.tsx), which is drawn in the browser and cannot read the request. Null where it could not be told.
 */
const Served = createContext<EditorKind | null>(null);

export function EditorServed({ kind, children }: { kind: EditorKind | null; children: ReactNode }) {
  return <Served.Provider value={kind}>{children}</Served.Provider>;
}

export const useEditorServed = () => useContext(Served);
