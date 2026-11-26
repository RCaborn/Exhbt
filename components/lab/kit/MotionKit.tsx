"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Tick } from "@/components/ui/Tick";
import { useLab } from "../LabFrame";
import { Compare, KitBlock, KitSection, Note, Proposed } from "./parts";
import { TokenValue } from "./TokenValue";

const TEMPOS = [
  { token: "--duration-fast", name: "Fast", use: "Feedback: a hover, a press, a field's edge." },
  { token: "--duration-medium", name: "Medium", use: "Something arriving: a menu, a sheet, a toast." },
  { token: "--duration-slow", name: "Slow", use: "A moment that is watched: ticks filling, a line being drawn." },
] as const;

const CURVES = [
  { token: "--ease-standard", name: "Standard", use: "A change of state." },
  { token: "--ease-entrance", name: "Entrance", use: "Something arriving." },
  { token: "--ease-move", name: "Move", use: "Something moving on the screen." },
  { token: "--ease-exit", name: "Exit", use: "Something leaving. It never overshoots." },
] as const;

const CHECKS = ["Confirmed by Amara", "Source attached", "Checked by exhbt"];

/** An easing token drawn as its curve, read from the page, so it follows the level. */
function Curve({ token }: { token: string }) {
  const probe = useRef<HTMLSpanElement>(null);
  const { level } = useLab();
  const [p, setP] = useState<number[] | null>(null);
  useEffect(() => {
    if (!probe.current) return;
    const m = getComputedStyle(probe.current)
      .getPropertyValue(token)
      .match(/cubic-bezier\(([^)]+)\)/);
    const n = m ? m[1]!.split(",").map((v) => Number(v.trim())) : null;
    setP(n && n.length === 4 && n.every(Number.isFinite) ? n : null);
  }, [token, level]);
  // x runs 0 to 1 left to right; y grows upwards, with room above 1 for an overshoot.
  const y = (v: number) => 100 - v * 100;
  return (
    <>
      <span ref={probe} hidden />
      <svg viewBox="-4 -28 108 136" className="kit-curve" role="img" aria-label={p ? `cubic-bezier(${p.join(", ")})` : "The curve"}>
        <path d="M0 100H100M0 0H100" stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {p && (
          <path
            d={`M0 100 C ${p[0]! * 100} ${y(p[1]!)}, ${p[2]! * 100} ${y(p[3]!)}, 100 0`}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <circle cx="0" cy="100" r="3.5" fill="var(--color-ink)" />
        <circle cx="100" cy="0" r="3.5" fill="var(--color-mint)" stroke="var(--color-ink)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  );
}

/** One moment: what it is called and where it is used, beside the thing itself. */
function Moment({ name, use, children }: { name: string; use: string; children: React.ReactNode }) {
  return (
    <div className="kit-moment">
      <div>
        <Text as="p" display="block" type="label">
          {name}
        </Text>
        <Text as="p" display="block" type="supporting">
          {use}
        </Text>
      </div>
      <div className="kit-moment-stage">{children}</div>
    </div>
  );
}

/**
 * Motion shown by small demonstrations. Nothing here moves until a button is pressed, nothing
 * loops, and the resting state of each is its finished state, so with Motion off (or the device's
 * reduced-motion setting) the page is the same page with nothing travelling. The two notes that
 * say so are shown by the stylesheet (kit.css, .kit-still-note), so the server never guesses.
 */
export function MotionKit() {
  const [at, setAt] = useState<"start" | "end">("start");
  const [run, setRun] = useState(0);
  return (
    <KitSection id="motion" rule="Motion confirms what just happened and shows where things came from. Three tempos, one character, and nothing loops.">
      <KitBlock title="Tempo">
        <Compare
          today={
            <div className="kit-stack">
              <p className="text-graphite">
                Seven <code>160ms ease</code> and one <code>260ms</code> written by hand in the stylesheet, and Astryx&rsquo;s defaults
                (125, 300 and 700ms) everywhere else. Sheets, menus and the phone bar appear at once.
              </p>
              <p className="kit-note">The one authored animation, ticks filling in, never runs: nothing switches it on.</p>
            </div>
          }
          proposed={
            <div className="kit-stack">
              <div className="kit-tempo" data-at={at}>
                {TEMPOS.map((t) => (
                  <div key={t.token} className="kit-tempo-row">
                    <div>
                      <Text as="p" display="block" type="label">
                        {t.name}{" "}
                        <Text type="supporting" hasTabularNumbers>
                          <TokenValue name={t.token} kind="time" />
                        </Text>
                      </Text>
                      <Text as="p" display="block" type="supporting">
                        {t.use}
                      </Text>
                    </div>
                    <div className="kit-track" style={{ "--kit-duration": `var(${t.token})` } as React.CSSProperties}>
                      <span className="kit-dot" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="kit-row">
                <Button label={at === "start" ? "Send them across" : "Send them back"} onClick={() => setAt(at === "start" ? "end" : "start")} />
                <span className="kit-still-note">
                  <Text type="supporting">Motion is off, so they jump.</Text>
                </span>
              </div>
            </div>
          }
        />
      </KitBlock>

      <KitBlock title="Character">
        <Proposed>
          <div className="kit-stack">
            <div className="kit-curves">
              {CURVES.map((c) => (
                <div key={c.token} className="kit-stack" data-gap="sm">
                  <Curve token={c.token} />
                  <div>
                    <Text as="p" display="block" type="label">
                      {c.name}
                    </Text>
                    <Text as="p" display="block" type="supporting">
                      {c.use}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
            <Note>
              The curves are the theme&rsquo;s easing tokens, drawn from the page. Restrained is crisp (no overshoot), confident overshoots a
              little, maximal a little more. Change the level in the lab bar and they redraw.
            </Note>
          </div>
        </Proposed>
      </KitBlock>

      <KitBlock title="Three moments">
        <Proposed>
          <div className="kit-stack">
            <div className="kit-moments">
              <Moment name="Ticks fill" use="The checks, one after another, when an exhbt is published.">
                <ul key={`ticks-${run}`} className="kit-ticks" data-run={run > 0 || undefined}>
                  {CHECKS.map((c, i) => (
                    <li key={c} style={{ "--i": i } as React.CSSProperties}>
                      <Tick size="lg" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </Moment>
              <Moment name="A line is drawn" use="The highlighter, under the gap an exhbt fills.">
                <Text as="p" display="block" type="large">
                  Nobody had tested whether{" "}
                  <span key={`stroke-${run}`} className="kit-stroke" data-run={run > 0 || undefined}>
                    the timing mattered
                  </span>
                  .
                </Text>
              </Moment>
              <Moment name="Something arrives" use="From just below where it lands, on the entrance curve.">
                <span key={`arrive-${run}`} className="kit-arrive" data-run={run > 0 || undefined}>
                  <Tick size="sm" /> Link copied
                </span>
              </Moment>
            </div>
            <div className="kit-row">
              <Button label={run ? "Play them again" : "Play the three moments"} onClick={() => setRun((n) => n + 1)} />
              <span className="kit-still-note">
                <Text type="supporting">Motion is off: each is already at rest, finished.</Text>
              </span>
            </div>
            <Note>Each plays once when asked and rests in its finished state. With Motion off, or a device set to reduce motion, nothing travels.</Note>
          </div>
        </Proposed>
      </KitBlock>
    </KitSection>
  );
}
