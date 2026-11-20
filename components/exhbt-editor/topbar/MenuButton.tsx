"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { deleteExhbt, unpublishExhbt } from "@/app/(app)/exhbts/[id]/actions";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { Button } from "@/components/ui/Button";
import { useEnv, useSave, useUi } from "../context";
import { Popover } from "./Popover";

const COARSE = "(pointer: coarse)";
const subscribeCoarse = (fn: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};
/** A touch screen, a phone or a tablet, where a long drag is hard. */
function useCoarse(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

/**
 * The menu at the end of the bar (decision 0026, "The chrome"). On a phone it also holds what the row has no
 * room for (`before`: the layout, Undo, See as a visitor, Card and link details). Then "Reorder sections" on a
 * touch screen only (with a mouse and keyboard the grip and the move buttons do it), "Unpublish" when live,
 * "Delete this exhbt", and "Use the classic editor".
 */
export function MenuButton({ before }: { before?: (close: (restoreFocus?: boolean) => void) => ReactNode }): ReactNode {
  const env = useEnv();
  const ui = useUi();
  const save = useSave();
  const coarse = useCoarse();
  const live = env.canGoLive && env.status === "published";

  async function classic() {
    // What was just typed is saved first, so the classic editor opens with it.
    await save.flush();
    const url = new URL(window.location.href);
    url.searchParams.set("editor", "classic");
    window.location.assign(url.pathname + url.search);
  }

  return (
    <Popover
      className="xe-menu"
      panelClassName="xe-menu-panel"
      trigger={({ id, open, toggle, panelId }) => (
        <Button id={id} size="sm" className="xe-tb xe-tb-icon" aria-expanded={open} aria-controls={open ? panelId : undefined} label="Menu" onClick={toggle}>
          <Ellipsis aria-hidden size={18} strokeWidth={2.25} />
        </Button>
      )}
    >
      {({ close }) => (
        <div className="xe-menu-items">
          {before?.(close)}
          {coarse && (
            <Button
              size="sm"
              className="xe-tb"
              onClick={() => {
                close(true);
                ui.open("reorder");
              }}
            >
              Reorder sections
            </Button>
          )}
          {live && <ConfirmAction label="Unpublish" question="Take it off your portfolio?" confirmLabel="Yes, unpublish" action={() => unpublishExhbt(env.id)} />}
          <ConfirmAction label="Delete this exhbt" variant="danger" question="Delete it for good?" confirmLabel="Yes, delete" action={() => deleteExhbt(env.id)} />
          <Button size="sm" className="xe-tb" onClick={() => void classic()}>
            Use the classic editor
          </Button>
        </div>
      )}
    </Popover>
  );
}
