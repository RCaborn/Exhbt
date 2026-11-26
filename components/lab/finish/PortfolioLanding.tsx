"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { useToast } from "@astryxdesign/core/Toast";
import { Token } from "@astryxdesign/core/Token";
import { PersonPage, useLab } from "../LabFrame";
import type { FinishWords } from "./words";

/** Where a tile stands: live already, a draft, or the one just published (it turns from Draft to Live). */
export type TileStatus = "live" | "draft" | "published";
export type LandingTile = { id: string; title: string; status: TileStatus; node: React.ReactNode };

const Live = () => <Token label="Live" color="green" icon={<StatusDot variant="success" label="Live" />} />;
const Draft = () => <Token label="Draft" icon={<StatusDot variant="neutral" label="Draft" />} />;

/** The logo's viewfinder brackets (components/brand/Logo.tsx, the Mark), drawn round one tile. */
function Brackets() {
  const arm = "M3 45V17A14 14 0 0 1 17 3h28";
  return (
    <span aria-hidden className="fin-brackets">
      <svg viewBox="0 0 48 48" className="fin-bracket" data-corner="start">
        <path d={arm} />
      </svg>
      <svg viewBox="0 0 48 48" className="fin-bracket" data-corner="end">
        <path d={arm} />
      </svg>
    </span>
  );
}

/**
 * Back on the portfolio after a first publish (decision 0031: /portfolio?at=<id>). A small stand-in
 * for the portfolio editor, which other agents are building: its bar, and three of her tiles drawn by
 * the real ProjectCard in her look. The tile she has just published turns from Draft to Live where it
 * sits, as the logo's viewfinder brackets close on it; then a note docks at the foot of the window
 * with its link and Copy link, which is decision 0031's note and the other answer to decision 0033's
 * question 7 (a panel over the page, or a note at its foot). Restrained has no brackets.
 *
 * The markup is the same with or without motion and rests on the finished state (the tile Live, the
 * brackets closed); "Play it again" re-keys the tiles, so their CSS runs once more.
 */
export function PortfolioLanding({
  words,
  tiles,
  look,
}: {
  words: FinishWords;
  tiles: LandingTile[];
  /** Her look's attributes and variables (themeFonts.ts), for the ground the tiles sit on. */
  look: { attrs: Record<string, string>; style: React.CSSProperties };
}) {
  const { motion } = useLab();
  const showToast = useToast();
  const [run, setRun] = useState(0);
  const marked = useRef<HTMLLIElement>(null);
  // The tile itself says which exhbt; the note says where it is.
  const line = `It's live at ${words.link}`;

  // Like the real landing (?at=<id>), the page comes to rest on the tile: before the first paint, so
  // the brackets close where they can be seen and nothing travels on the way there.
  useLayoutEffect(() => {
    const tile = marked.current;
    if (!tile) return;
    const r = tile.getBoundingClientRect();
    // The note docks at the foot of the window, so the tile has to clear the lower part of it too.
    if (r.top < 0 || r.bottom > window.innerHeight * 0.72) tile.scrollIntoView({ block: "center", behavior: "instant" });
  }, [run]);

  useEffect(() => {
    let dismiss: (() => void) | undefined;
    const note = (body: string) => {
      dismiss = showToast({
        body,
        uniqueID: "fin-at",
        isAutoHide: false,
        endContent: (
          <Button
            label="Copy link"
            variant="primary"
            size="lg"
            onClick={() => {
              navigator.clipboard
                .writeText(`https://${words.link}`)
                .then(() => note(`Link copied: ${words.link}`))
                .catch(() => note(`We couldn't copy it. The link is ${words.link}`));
            }}
          />
        ),
      });
    };
    // Asked here rather than from `moves`, which is still false while the page is taking over the
    // server's HTML: with less motion the note is there at once, otherwise once the tile has turned.
    const still = motion === "off" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => note(line), still ? 0 : 1200);
    return () => {
      window.clearTimeout(t);
      dismiss?.();
    };
  }, [run, motion, showToast, line, words.link]);

  return (
    <section className="fin-stage lab-content" aria-labelledby="fin-stage-title">
      <h2 id="fin-stage-title" className="sr-only">
        Her portfolio, a stand-in for the portfolio editor
      </h2>
      <div className="fin-replay">
        <Button label="Play it again" variant="secondary" size="lg" onClick={() => setRun((n) => n + 1)} />
      </div>
      <div className="fin-window">
        <div className="fin-bar">
          <span className="fin-bar-title">
            <Text type="label">Your portfolio</Text>
          </span>
          <Live />
          <span className="fin-bar-gap" />
          <span className="fin-bar-wide">
            <Button label="Add an exhbt" variant="secondary" icon={<Icon icon={Plus} />} href={words.nextHref} />
          </span>
        </div>
        <div {...look.attrs} style={look.style} className="fin-folio">
          <PersonPage>
            <p className="fin-folio-title pf-display">My work</p>
          </PersonPage>
          <ul key={run} className="fin-tiles" aria-label="Her exhbts">
            {tiles.map((t) => (
              <li key={t.id} ref={t.status === "published" ? marked : undefined} className="fin-tile" data-status={t.status}>
                {t.status === "published" && <Brackets />}
                <span className="fin-tile-status">
                  {t.status === "draft" && <Draft />}
                  {t.status === "live" && <Live />}
                  {t.status === "published" && (
                    <>
                      <span className="fin-tile-was" aria-hidden>
                        <Draft />
                      </span>
                      <span className="fin-tile-now">
                        <Live />
                      </span>
                    </>
                  )}
                </span>
                <PersonPage className="fin-tile-page">{t.node}</PersonPage>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
