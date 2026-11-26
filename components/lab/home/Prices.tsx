import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { BILLING_PERIOD, PLAN_NAMES, PRICES } from "@/lib/entitlements";

/**
 * "Free to start. Pay to put it online." (beat seven), in a line with a link. Every price and plan
 * name is read from lib/entitlements.ts. The difference the money makes is shown as the product
 * shows it: a draft only its owner can see, or a page that is live at its address.
 */
export function Prices() {
  return (
    <section id="prices" aria-labelledby="hl-prices-title" className="hl-section hl-prices">
      <div className="lab-content hl-prices-grid">
        <Heading level={2} type="display-2" id="hl-prices-title">
          Free to start. Pay to put it online.
        </Heading>
        <div className="hl-prices-words">
          <Text as="p" display="block" type="large">
            The roadmap is free, and so is making your first exhbt. {PLAN_NAMES.premium} is {PRICES.premium} a {BILLING_PERIOD} and {PLAN_NAMES.max} is{" "}
            {PRICES.max} a {BILLING_PERIOD}. <Link className="hl-hit" href="/pricing">Compare plans</Link>
          </Text>
          <ul className="hl-states">
            <li>
              <Token label="Draft" size="sm" />
              <Text color="secondary">
                On {PLAN_NAMES.free}, your exhbt is a draft and your page a preview, and only you can see them.
              </Text>
            </li>
            <li>
              <span className="hl-live">
                <StatusDot variant="success" label="Live" />
                <Text type="label">Live</Text>
              </span>
              <Text color="secondary">
                On {PLAN_NAMES.premium} and {PLAN_NAMES.max}, they&rsquo;re live at your address for anyone you send the link to.
              </Text>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
