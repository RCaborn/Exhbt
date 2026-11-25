import type { ReactNode } from "react";
import type { EditorKind } from "@/lib/editor-kind";
import { editorServed } from "@/lib/editor-kind-server";
import { EditorServed } from "./served";

/**
 * The edit route's layout, there only for its error page (error.tsx): it says which editor the switch serves
 * this person, as the page decides it (decision 0026, "The switch"). A layout sits outside its route's error
 * boundary, so this is known when the page itself fails on the server. The error page reads `?editor=classic`
 * itself. If even this fails, the error page goes by the address alone, as it did before.
 */
export default async function EditLayout({ children }: { children: ReactNode }) {
  let kind: EditorKind | null = null;
  try {
    kind = await editorServed();
  } catch (e) {
    console.error("The edit route could not tell which editor it serves:", e);
  }
  return <EditorServed kind={kind}>{children}</EditorServed>;
}
