"use client";

import Link from "next/link";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { exhbtTheme } from "@/themes/exhbt/exhbt";

/**
 * Astryx (the design system behind the buttons) needs its theme and to know that links
 * are Next.js links. The site is light only. Theme source: themes/exhbt/exhbtTheme.ts.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={exhbtTheme} mode="light">
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
