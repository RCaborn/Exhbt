import { Button } from "@astryxdesign/core/Button";
import { TopNav, TopNavItem } from "@astryxdesign/core/TopNav";
import { Logo } from "@/components/brand/Logo";

/**
 * Home's top bar, as a signed-out visitor has it: the brand, three links into the page's own story
 * and "Log in". No button in it: the page's one mint button is the hero's, so the bar never offers
 * a second way in (the journey review's first finding). Astryx TopNav in the proposed theme, which
 * pads it to the same content line as the page under it. On a phone the links go and the brand and
 * "Log in" stay; the links are sections of this page, a scroll away.
 */
export function HomeNav() {
  return (
    <TopNav
      label="Exhbt"
      heading={<Logo href="#main" />}
      startContent={
        <span className="hl-nav-links">
          <TopNavItem label="What is an exhbt?" href="#one-page" />
          <TopNavItem label="How it works" href="#how" />
          <TopNavItem label="Pricing" href="#prices" />
        </span>
      }
      endContent={<Button label="Log in" href="/login" variant="ghost" />}
    />
  );
}
