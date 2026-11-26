import { Logo } from "@/components/brand/Logo";

/**
 * The logo as a link home. Its own file, so a page that shows only the logo (/start, the ads' landing page)
 * does not load the header's Astryx navigation with it.
 */
export function Wordmark() {
  return <Logo href="/" />;
}
