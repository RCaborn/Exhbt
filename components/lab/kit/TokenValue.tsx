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
 * What one of the theme's tokens is set to here, read from the page itself: at this level, at this
 * width. So the kit's figures can't drift from the stylesheets (one owner per fact). A size is shown
 * in px, a duration in ms, anything else as written. Blank until the page has loaded.
 */
export function TokenValue({ name, kind = "raw" }: { name: string; kind?: Kind }) {
  const probe = useRef<HTMLSpanElement>(null);
  const { level, motion } = useLab();
  const [value, setValue] = useState("");
  useEffect(() => {
    const update = () => probe.current && setValue(read(probe.current, name, kind));
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
