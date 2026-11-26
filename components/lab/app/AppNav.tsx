"use client";

import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavItem } from "@astryxdesign/core/TopNav";
import { LogOut, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { appHref, type AppScreen } from "./screens";
import type { AppWords } from "./words";

/**
 * The top of the app's frame (decision 0031, "The nav"): the logo, "Your portfolio", then
 * "Roadmaps", with the account in the corner. Astryx TopNav in the proposed theme, which pads it
 * to the content line, so the logo and every page's first line share one left edge. Below 768px
 * AppShell folds the two nav items into its drawer and keeps the account corner in the bar.
 *
 * The account corner is a DropdownMenu hung off the person's Avatar: their initials, and their
 * first name beside it on a wide window. It is 44px tall at every width.
 */
export function AppNav({ screen, portfolio, person, onLogOut }: { screen: AppScreen; portfolio: AppScreen; person: AppWords["person"]; onLogOut: () => void }) {
  const onPortfolio = screen === "first-run" || screen === "work";
  return (
    <TopNav
      label="Main"
      heading={<Logo href={appHref(portfolio)} className="app-logo" />}
      startContent={
        <>
          <TopNavItem label="Your portfolio" href={appHref(portfolio)} isSelected={onPortfolio} />
          <TopNavItem label="Roadmaps" href={appHref("roadmaps")} isSelected={screen === "roadmaps"} />
        </>
      }
      endContent={
        <DropdownMenu
          alignment="end"
          menuWidth={240}
          header={
            <div className="app-menu-who">
              <Text as="p" display="block" type="label">
                {person.name}
              </Text>
              <Text as="p" display="block" type="supporting">
                {person.email}
              </Text>
            </div>
          }
          items={[
            { label: "Account and billing", href: appHref("account"), icon: <Icon icon={UserRound} /> },
            { type: "divider" },
            { label: "Log out", icon: <Icon icon={LogOut} />, onClick: onLogOut },
          ]}
          renderTrigger={(props) => (
            <Button
              {...props}
              label={`Your account, ${person.name}`}
              variant="ghost"
              size="lg"
              className="app-account"
              data-here={screen === "account" || undefined}
              icon={<Avatar name={person.name} size={32} tooltip={false} />}
              endContent={<Icon icon="chevronDown" />}
            >
              <span className="app-account-name">{person.first}</span>
            </Button>
          )}
        />
      }
    />
  );
}
