"use client";

import { useEffect, useState } from "react";

/**
 * True when the person has asked for less motion (prefers-reduced-motion). For motion set in
 * script, such as dnd-kit's sorting and drop animations, which the stylesheet's reduced-motion
 * rule (app/globals.css) can't always reach. False on the server and until the page has loaded.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
