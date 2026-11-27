"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Ellipsis, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteExhbt, unpublishExhbt } from "@/app/(app)/exhbts/[id]/actions";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { DeleteExhbt } from "@/components/editor/DeleteExhbt";
import { Button } from "@/components/ui/Button";
import { setLive, useEnv, useLive, useSave, useUi } from "../context";
import { flushPending } from "../pending";
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
 * "Delete this exhbt", and "Use the classic editor". "Add teammates" comes first when there is no team yet.
 */
export function MenuButton({ before }: { before?: (close: (restoreFocus?: boolean) => void) => ReactNode }): ReactNode {
  const env = useEnv();
  const ui = useUi();
  const save = useSave();
  const coarse = useCoarse();
  const status = useLive();
  const router = useRouter();
  // With no team yet the offer to add teammates is here, not in a strip above the editor (brief 5b). With a team, the strip says so.
  const offerTeam = (env.team?.length ?? 0) === 0;
  const live = env.canGoLive && status.status === "published";

  async function classic() {
    // What was just typed is saved first, so the classic editor opens with it.
    await save.flush();
    // An admin's choice is stored (POST /api/exhbts/editor, lib/editor-kind.ts): this address then serves the classic editor
    // from now on, so the page is loaded again as it is. Everyone else, and an admin whose choice could not be stored, gets
    // the classic editor by the address, for this visit.
    const choice = new FormData();
    choice.set("kind", "classic");
    const stored = env.adminSwitch
      ? await fetch("/api/exhbts/editor", { method: "POST", body: choice }).then(
          (res) => res.ok,
          () => false,
        )
      : false;
    if (stored) return window.location.reload();
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
          {offerTeam && (
            <Button
              size="sm"
              className="xe-tb"
              href={`/exhbts/${env.id}/team`}
              label="Add teammates"
              onClick={(e) => {
                // The last change lands first; a new tab or window keeps the browser's own behaviour.
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                close();
                void flushPending().then(() => router.push(`/exhbts/${env.id}/team`));
              }}
            >
              <UsersRound aria-hidden size={16} strokeWidth={2.25} className="shrink-0" />
              Add teammates
            </Button>
          )}
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
          {live && (
            <ConfirmAction
              label="Unpublish"
              question="Take it off your portfolio?"
              confirmLabel="Yes, unpublish"
              action={async () => {
                // Said first: the action ends by sending the page back to itself.
                setLive(env.id, "draft", status.slug);
                await unpublishExhbt(env.id);
              }}
            />
          )}
          <DeleteExhbt id={env.id} action={() => deleteExhbt(env.id)} />
          <Button size="sm" className="xe-tb" onClick={() => void classic()}>
            Use the classic editor
          </Button>
        </div>
      )}
    </Popover>
  );
}
