import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Block, Compare, Group, Stack } from "./parts";
import { AppParts } from "./AppParts";
import { Controls, Feedback, Overlays, Structure } from "./Kit";
import { Faq } from "@/components/home/Faq";

export const metadata: Metadata = { title: "Astryx kit", robots: { index: false, follow: false } };
// The gate is read on each request, so one build serves the preview Worker (EXHBT_LAB=1) and the live one (never set).
export const dynamic = "force-dynamic";

/*
 * The Astryx kit under the real theme (themes/exhbt/exhbtTheme.ts): each part the site is about to use, straight from
 * Astryx with no local styling, beside the hand-built thing it replaces ("Today"). It is how the theme's gaps show, and
 * when this page and the lab's Kit page (/lab/design/kit) match, the proposed theme has been moved across.
 *
 * Not found in production unless the build has EXHBT_LAB=1 (it is never set on the live Worker).
 */
const enabled = () => process.env.NODE_ENV !== "production" || process.env.EXHBT_LAB === "1";

export default async function DevAstryx({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  if (!enabled()) notFound();
  // ?only=app-parts draws just the app's own parts: the tests that look for animation need a page with no skeleton or spinner.
  const { only } = await searchParams;
  if (only === "app-parts") {
    return (
      <main id="main" className="mx-auto max-w-[76rem] px-4 py-10 sm:px-8">
        <Heading level={1}>Astryx kit: the app&rsquo;s own parts</Heading>
        <AppParts />
      </main>
    );
  }
  return (
    <main id="main" className="mx-auto max-w-[76rem] px-4 py-10 sm:px-8">
      <Heading level={1} type="display-2">
        Astryx kit
      </Heading>
      <Text as="p" display="block" color="secondary" type="large">
        Every Astryx part the site is about to use, under the theme every real page gets. Where the site builds the same thing by hand today, that sits beside it.
      </Text>

      <Group id="type" title="Type" purpose="The headings and text types. Nothing here carries its own styling.">
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          <Stack>
            <Heading level={1}>Heading 1</Heading>
            <Heading level={2}>Heading 2</Heading>
            <Heading level={3}>Heading 3</Heading>
          </Stack>
          <Stack>
            <Heading level={2} type="display-1">
              Display 1
            </Heading>
            <Heading level={2} type="display-2">
              Display 2
            </Heading>
            <Heading level={2} type="display-3">
              Display 3
            </Heading>
          </Stack>
          <Stack>
            {(["body", "large", "label", "supporting", "code"] as const).map((t) => (
              <Text key={t} as="p" display="block" type={t}>
                Text, {t}
              </Text>
            ))}
          </Stack>
        </div>
      </Group>

      <Controls />
      <Feedback />
      <Overlays />
      <Structure />

      <AppParts />

      <Group id="today-only" title="Hand-built today" purpose="The parts the site draws by hand that have no Astryx twin on this page yet.">
        <Block title="A question that opens (the home page's Faq)">
          <Compare
            astryx={<Text as="p" color="secondary">Astryx 0.7.11 has no accordion, so the native details stays.</Text>}
            today={<Faq items={[
              { q: "Will the AI make things up?", a: "It’s told to use only what you gave it, and any number it can’t find in your files is flagged for you to fix. Nothing goes live until you’ve confirmed it’s accurate and your own." },
              { q: "Who can see my exhbts?", a: "Only you, until you publish one. A published exhbt is on your public portfolio, and you can ask search engines to leave it out." },
              { q: "What if I stop paying?", a: "Nothing is deleted. Your portfolio shows as many published exhbts as your new plan allows, in your order." },
            ]} />}
          />
        </Block>
      </Group>
    </main>
  );
}
