import { Button } from "@astryxdesign/core/Button";
import { TopNav, TopNavItem } from "@astryxdesign/core/TopNav";
import { Logo } from "@/components/brand/Logo";
import { LAB_PATH } from "../lab";

/**
 * Home's top bar, as a signed-out visitor has it: the brand, four links into the page's own story (the free roadmap among them, the way in that needs no account),
 * "Log in", and the hero's one action again, under the same label (the appeal plan's job 6a: the
 * header's button says what the hero's says, so there is one way in, not two). It is the quiet
 * button, not mint: the page's one mint button is the hero's. Astryx TopNav in the proposed theme,
 * which pads it to the same content line as the page under it. On a phone the links and the button
 * go and the brand and "Log in" stay; the hero's button is in the first screen there.
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
          <TopNavItem label="Free roadmap" href="#roadmap" />
          <TopNavItem label="Pricing" href="#prices" />
        </span>
      }
      endContent={
        <span className="hl-nav-end">
          <Button label="Log in" href="/login" variant="ghost" />
          <span className="hl-nav-start">
            <Button label="Start your portfolio" href={`${LAB_PATH}/app`} variant="secondary" />
          </span>
        </span>
      }
    />
  );
}
