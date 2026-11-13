"use client";

import { useEffect } from "react";

/**
 * A full page load, not a client-side redirect. The sign-in cookie is set by the
 * response the browser actually receives (/auth/dev, or the action that set a Supabase session).
 * A client-side redirect renders the next page without keeping that cookie.
 */
export function useContinue(url: string | undefined) {
  useEffect(() => {
    if (url && url.startsWith("/") && !url.startsWith("//")) window.location.assign(url);
  }, [url]);
}
