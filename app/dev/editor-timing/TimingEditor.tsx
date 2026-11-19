"use client";

import dynamic from "next/dynamic";
import { SaveOverride } from "@/components/exhbt-editor/Autosave";
import type { PageEditorProps } from "@/components/exhbt-editor/context";

/** The editor, loaded in the browser only (as the edit page loads it), with a save that does nothing. */
const PageEditor = dynamic(() => import("@/components/exhbt-editor/EditorShell").then((m) => m.PageEditor), { ssr: false });

const saveNothing = async () => ({ ok: true as const });

export function TimingEditor(props: PageEditorProps) {
  return (
    <SaveOverride value={saveNothing}>
      <PageEditor {...props} />
    </SaveOverride>
  );
}
