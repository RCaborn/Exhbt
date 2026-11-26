"use client";

import { useEffect, useRef, useState } from "react";
import { useLab } from "../LabFrame";

type Kind = "size" | "time" | "raw";

const read = (el: HTMLElement, name: string, kind: Kind): string => {
  const style = getComputedStyle(el);
  if (kind === "size") return `${Math.round(parseFloat(style.fontSize) * 10) / 10}px`;
  if (kind === "time") {
    const v = style.transitionDuration.split(",")[0]!.trim();
    return `${Math.round(parseFloat(v) * (v.endsWith("ms") ? 1 : 1000))}ms`;
  }
  return style.getPropertyValue(name).trim();
};

/**
 * A duration as this level sets it with motion on. The lab's Motion off switch drops every duration
 * to 1ms on the lab's root, so the figure is read from a hidden twin of the root (same level, motion
 * on) placed beside it for a moment: the kit shows the level's timing, not the switch's.
 */
function readTimeWithMotion(probe: HTMLElement, name: string): string {
  const root = probe.closest<HTMLElement>("[data-lab-root]");
  if (!root?.parentElement || root.dataset.motion !== "off") return read(probe, name, "time");
  const twin = root.cloneNode(false) as HTMLElement;
  twin.dataset.motion = "on";
  twin.hidden = true;
  const p = document.createElement("span");
  p.style.transitionDuration = `var(${name})`;
  twin.appendChild(p);
  root.parentElement.appendChild(twin);
  const v = read(p, name, "time");
  twin.remove();
  return v;
}

/**
 * What one of the theme's tokens is set to here, read from the page itself: at this level, at this
 * width. So the kit's figures can't drift from the stylesheets (one owner per fact). A size is shown
 * in px, a duration in ms (as the level has it with motion on), anything else as written. Blank until
 * the page has loaded.
 */
export function TokenValue({ name, kind = "raw" }: { name: string; kind?: Kind }) {
  const probe = useRef<HTMLSpanElement>(null);
  const { level, motion } = useLab();
  const [value, setValue] = useState("");
  useEffect(() => {
    const update = () => {
      const el = probe.current;
      if (el) setValue(kind === "time" ? readTimeWithMotion(el, name) : read(el, name, kind));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [name, kind, level, motion]);
  const style = kind === "size" ? { fontSize: `var(${name})` } : kind === "time" ? { transitionDuration: `var(${name})` } : undefined;
  return (
    <>
      <span ref={probe} hidden style={style} />
      <span data-token={name}>{value || "…"}</span>
    </>
  );
}
