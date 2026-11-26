"use client";

import { createContext, use, useCallback, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { Theme } from "@astryxdesign/core/theme";
import { exhbtTheme } from "@/themes/exhbt/exhbt";
import { exhbtNextTheme } from "@/themes/exhbt-next";
import { LAB_COOKIE, LAB_PATH, type Bar, type LabState, type Level, type Motion } from "./lab";
import { LabBar } from "./LabBar";

/**
 * What a lab component can read in the browser.
 * - `level`: restrained, confident or maximal.
 * - `motion`: "on" unless the lab's Motion off switch is set.
 * - `moves`: true only when motion is on and the person hasn't asked their device for less of it.
 *   Motion run from script (a view transition, an observer that starts something) checks this one.
 *   It is false on the server and until the device has been asked, so nothing starts for someone
 *   who wanted stillness: start script motion from an effect that depends on it, and don't draw
 *   different markup from it (the server's would flash). What shows or hides is CSS's job.
 */
export type Lab = LabState & {
  moves: boolean;
  setLevel: (level: Level) => void;
  setMotion: (motion: Motion) => void;
  setBar: (bar: Bar) => void;
};

const LabContext = createContext<Lab | null>(null);

/** The lab's switches, in a client component under app/lab/design. Server components use `readLab()`. */
export function useLab(): Lab {
  const lab = use(LabContext);
  if (!lab) throw new Error("useLab() only works under the design lab's frame (app/lab/design/layout.tsx).");
  return lab;
}

// Whether the device asks for less motion. Until it has been asked (on the server, and while the
// page is taking over the server's HTML) the answer is assumed to be yes.
const LESS_MOTION = "(prefers-reduced-motion: reduce)";
const watchDevice = (changed: () => void) => {
  const query = window.matchMedia(LESS_MOTION);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
};
const askDevice = () => window.matchMedia(LESS_MOTION).matches;
const assumeLess = () => true;

const YEAR = 60 * 60 * 24 * 365;
const keep = (name: string, value: string) => {
  document.cookie = `${name}=${value}; path=${LAB_PATH}; max-age=${YEAR}; samesite=lax`;
};

/**
 * The lab's frame: the proposed theme on everything inside it, a root element that carries the
 * level and the motion switch as attributes (`data-level`, `data-motion`) for CSS, the same two as
 * context for components, and the lab bar. The layout renders it with the switches as the request's
 * cookies had them, so the first paint is already at the chosen level.
 *
 * A second Astryx theme on a subtree is a nested `Theme`: the built stylesheet scopes every rule to
 * `[data-astryx-theme="exhbt-next"]`, stopping at the next themed element, so the production theme
 * outside the lab (app/providers.tsx) is untouched. Astryx keeps a menu, a popover or a dialog
 * inside the element that opened it, so they are themed too; toasts need the LayerProvider here.
 */
export function LabFrame({ initial, children }: { initial: LabState; children: React.ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState(initial);
  const reduced = useSyncExternalStore(watchDevice, askDevice, assumeLess);

  // A switch changes at once (the attribute and the context), is kept in a cookie, and then the
  // server components are asked again, so anything drawn per level on the server follows.
  const change = useCallback(
    (patch: Partial<LabState>) => {
      setState((s) => ({ ...s, ...patch }));
      if (patch.level) keep(LAB_COOKIE.level, patch.level);
      if (patch.motion) keep(LAB_COOKIE.motion, patch.motion);
      if (patch.bar) keep(LAB_COOKIE.bar, patch.bar);
      startTransition(() => router.refresh());
    },
    [router],
  );

  const lab = useMemo<Lab>(
    () => ({
      ...state,
      moves: state.motion === "on" && !reduced,
      setLevel: (level) => change({ level }),
      setMotion: (motion) => change({ motion }),
      setBar: (bar) => change({ bar }),
    }),
    [state, reduced, change],
  );

  return (
    <div data-lab-shell>
      <Theme theme={exhbtNextTheme} mode="light">
        <LayerProvider>
          <LabContext value={lab}>
            <div data-lab-root data-level={state.level} data-motion={state.motion}>
              <LabBar />
              {children}
            </div>
          </LabContext>
        </LayerProvider>
      </Theme>
    </div>
  );
}

/**
 * The site as it is today, drawn inside the lab for comparison: the production theme and the
 * site's own tokens, with none of the lab's. Wrap a "today" sample in it.
 */
export function Today({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={exhbtTheme} mode="light">
      <div data-lab-today>{children}</div>
    </Theme>
  );
}

/**
 * A person's own page (a portfolio, an exhbt) inside the lab. It is theirs, in the look they
 * chose, so the proposed theme never restyles it: it sits under the production theme with the
 * site's tokens, exactly as on the live site. `Frame` (components/lab/Frame.tsx) uses it.
 */
export function PersonPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Theme theme={exhbtTheme} mode="light">
      <div data-lab-page className={className}>
        {children}
      </div>
    </Theme>
  );
}
