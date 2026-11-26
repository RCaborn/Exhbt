import type { PortfolioData } from "@/app/(app)/portfolio/load";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import type { HomeEdit } from "@/components/portfolio/home-ctx";
import { PortfolioHome } from "@/components/portfolio/PortfolioHome";
import { lookAttrs, themeStyle } from "@/components/portfolio/themeFonts";
import { BAR_H, GROUND } from "./geometry";
import { StripStandIn } from "./bar/strip";
import { editingHome } from "./home-props";

/*
 * The loading stand-in (decision 0031, "The switch": "The editor is drawn only in the browser, inside
 * that boundary"). Until the editor's chunk has loaded, and on the server, `/portfolio` shows the page
 * drawn with this static adapter: the same slots, with what takes room in the editor only drawn inert
 * (each empty field's placeholder as words, an empty section whole), and every control left out, as
 * controls take no room. So the fields come alive in place and nothing moves when the editor arrives.
 *
 * No hooks and no state: this file is in the gate's own chunk (PortfolioGate.tsx), and the gate draws
 * it on the server too. Nothing here carries a field's id or data-path, so a test or a jump that looks
 * for a field never lands on the stand-in.
 */

const muted = { color: "var(--xp-muted)" } as const;

/** The adapter the loading view draws with: the words as the page has them, an empty field's placeholder, and no control. */
export function standInAdapter(): HomeEdit {
  return {
    // A block field is a block in the editor: its words here are one too, so an empty parent keeps the line.
    text: (s) =>
      s.as === "inline" ? (
        <span data-stand-in="text" style={s.value.trim() ? undefined : muted}>
          {s.value.trim() ? s.value : s.placeholder}
        </span>
      ) : (
        <span data-stand-in="text" className="block whitespace-pre-wrap [overflow-wrap:break-word]" style={s.value.trim() ? undefined : muted}>
          {s.value.trim() ? s.value : s.placeholder}
        </span>
      ),
    paras: (s) => {
      const paras = s.value.split("\n\n");
      return (
        <div data-stand-in="paras" className="contents">
          {paras.map((p, i) => (
            // A <p>, as the visitor's paragraph and the field's own box are: the site's reset sets a <p>'s type.
            <p key={i} className={`${s.paraClass} whitespace-pre-wrap [overflow-wrap:break-word]`} style={s.value.trim() ? undefined : muted}>
              {/* An empty paragraph among others keeps its line, as its field does. */}
              {s.value.trim() ? p || "\u200b" : s.placeholder}
            </p>
          ))}
        </div>
      );
    },
    photo: (face) => face,
    section: (_s, node) => node,
    tile: (_s, node) => node,
    lineTools: () => null,
    owner: () => null,
    tools: () => null,
  };
}

/**
 * The editing page as the stand-in draws it: an empty bar where the editor's bar will be, exactly as
 * tall, then the first-run strip as the editor will first draw it (bar/strip.tsx; none once hidden), then
 * the page in the person's look. The page is inert: nothing in it is a control yet. `state`
 * is the words to draw when they are newer than the data's own (the gate waiting for newer data).
 */
export function StandInPage({ data, state }: { data: PortfolioData; state?: BuilderState }) {
  const home = editingHome(state ?? data.builder.initial, data);
  return (
    <>
      <div aria-hidden className="border-b border-line bg-surface" style={{ height: BAR_H }} />
      <StripStandIn data={data} state={state ?? data.builder.initial} />
      <div {...lookAttrs(home.theme)} style={themeStyle(home.theme)} className={GROUND} data-canvas="stand-in" inert>
        <PortfolioHome {...home} edit={standInAdapter()} />
      </div>
    </>
  );
}
