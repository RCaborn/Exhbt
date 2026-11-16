"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the first client render, true once React has taken over the page.
 * Text typed into a field before that moment is thrown away or merged with the server's value,
 * so forms hold their fields read-only until this is true (and set `data-ready` for tests).
 */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
