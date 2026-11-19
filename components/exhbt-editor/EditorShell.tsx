"use client";

import type { PageEditorProps } from "./context";
import { StandInPage } from "./StandIn";

/**
 * The edit-on-page editor (decision 0026). A stub until G builds it: it draws what the loading view
 * draws (StandIn.tsx), marked ready. It is loaded only in the browser, inside the gate's error
 * boundary (EditorGate.tsx), so a throw here reloads the page into the classic editor.
 *
 * In development only, `?crash=render` makes it throw whenever it draws, for e2e/editor-classic.spec.ts.
 * It throws every time, not once: React draws a component again after a throw before it gives up,
 * so a single throw could be absorbed and the boundary never see it.
 */
export function PageEditor(props: PageEditorProps) {
  if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("crash") === "render") {
    throw new Error("The new editor was told to fail (?crash=render, development only).");
  }
  return (
    <div data-editor="page" data-ready="true">
      <StandInPage {...props} />
    </div>
  );
}
