import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { WhereItGoes } from "@/components/editor/PublishWhere";
import { Preview } from "@/components/home/Preview";
import { ProjectView } from "@/components/portfolio/ProjectView";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { BUILD_IT_YOURSELF, DRAFT_WITH_AI } from "@/lib/add-exhbt";
import type { DraftVerdict } from "@/lib/drafting";
import type { Plan } from "@/lib/entitlements";
import { demoExhbts, demoOwner } from "@/lib/exhbt";
import type { Format } from "@/lib/exhbt/formats";
import { whereAPublishedExhbtGoes } from "@/lib/exhbt/publish-words";
import { WHAT_AN_EXHBT_IS } from "@/lib/exhbt/what-it-is";
import { portfolioHost, portfolioUrl } from "@/lib/hosts";
import { DraftedArt, LayoutsArt } from "./art";
import { Glyph } from "./glyphs";
import "./add-exhbt.css";

/** The page's frame: the app's mist ground and one column, shared by the chooser, the layouts and the full-plan notice. */
export function AddFrame({ children }: { children: React.ReactNode }) {
  return (
    <Section variant="muted" padding={0} className="add-exhbt px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <VStack gap={8} className="mx-auto max-w-6xl">
        {children}
      </VStack>
    </Section>
  );
}

/** The way back up: from the chooser to the list of exhbts, from the layouts to the chooser. */
export function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} isStandalone color="secondary" weight="semibold">
      <HStack as="span" gap={1} vAlign="center">
        <Glyph name="back" />
        {children}
      </HStack>
    </Link>
  );
}

/**
 * Where a finished exhbt goes. On a plan with a public portfolio it is the publish step's own sentence
 * (WhereItGoes); on Free, where publishing isn't included, the same promise for later and the plan rule's
 * reason (canPublish).
 */
export type Where = { live: true; liveBase: string | null } | { live: false; reason: string };

/**
 * The chooser: what an exhbt is, two ways to start of equal weight, and where it ends up.
 *
 * Each way is one Astryx Card with one real control, a link (components/ui/Button.tsx with `href`), whose
 * press area the stylesheet stretches over the whole card. So a card is pressed anywhere, with or without
 * the page's scripts, and each is one stop for the keyboard.
 */
export function Chooser({ draft, offered, where }: { draft: DraftVerdict; offered: readonly Format[]; where: Where }) {
  return (
    <AddFrame>
      <VStack gap={3} hAlign="start">
        <Back href="/exhbts">Your exhbts</Back>
        <Heading level={1}>Add an exhbt</Heading>
        <Text as="p" type="large" weight="normal" color="secondary" className="max-w-2xl">
          {WHAT_AN_EXHBT_IS}
        </Text>
      </VStack>

      <Grid columns={{ minWidth: 300, max: 2 }} gap={6}>
        <VStack className="add-cell">
          <Card className="add-way grow" padding={6} data-way="draft" data-off={draft.ok ? undefined : ""}>
            <VStack gap={5} height="100%">
              <DraftedArt />
              <VStack gap={2}>
                <Heading level={2}>Draft it with AI</Heading>
                <Text as="p" color="secondary">
                  Upload your report, slides, pictures or a link. We write a first draft from them, choose a layout and take the key figure from your work.
                </Text>
                <Text as="p" type="supporting">
                  The AI only uses what is in your files.
                </Text>
              </VStack>
              {draft.ok ? (
                <VStack gap={3} className="mt-auto">
                  <HStack gap={4} vAlign="center" wrap="wrap">
                    <Button href={DRAFT_WITH_AI} label="Upload your project" className="add-go">
                      Upload your project <Glyph name="go" />
                    </Button>
                    <Text type="supporting" hasTabularNumbers>
                      {draft.left} of {draft.perPeriod} AI {draft.perPeriod === 1 ? "draft" : "drafts"} left
                    </Text>
                  </HStack>
                  <Next>You&apos;ll add your files, then get a first draft to edit.</Next>
                </VStack>
              ) : (
                <VStack className="mt-auto">
                  <UpgradePrompt reason={draft.reason} upgradeTo={draft.upgradeTo} primary={false} />
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>

        <VStack className="add-cell">
          <Card className="add-way grow" padding={6} data-way="blank">
            <VStack gap={5} height="100%">
              <LayoutsArt offered={offered} />
              <VStack gap={2}>
                <Heading level={2}>Build it yourself</Heading>
                <Text as="p" color="secondary">
                  Start with an empty page in the layout you choose, and type straight onto it.
                </Text>
              </VStack>
              <VStack gap={3} className="mt-auto">
                <HStack gap={4} vAlign="center" wrap="wrap">
                  <Button href={BUILD_IT_YOURSELF} label="Choose a layout" className="add-go">
                    Choose a layout <Glyph name="go" />
                  </Button>
                </HStack>
                <Next>You&apos;ll choose a layout, then land on an empty page.</Next>
              </VStack>
            </VStack>
          </Card>
        </VStack>
      </Grid>

      <WhereItEndsUp where={where} />
    </AddFrame>
  );
}

/** What happens straight after the button above it is pressed. */
function Next({ children }: { children: React.ReactNode }) {
  return (
    <HStack gap={1.5} vAlign="start">
      <Glyph name="next" color="secondary" className="mt-0.5 shrink-0" />
      <Text as="p" type="supporting">
        {children}
      </Text>
    </HStack>
  );
}

/**
 * Where the exhbt ends up, shown with a real one: the demo's first exhbt drawn by the product's own page
 * (ProjectView) at its address, as a picture (components/home/Preview.tsx).
 */
function WhereItEndsUp({ where }: { where: Where }) {
  const example = demoExhbts[0]!;
  return (
    <Section variant="transparent" dividers={["top"]} padding={0} paddingBlockStart={8}>
      <Grid columns={{ minWidth: 300, max: 2 }} gap={8} align="center">
        <VStack gap={3} hAlign="start">
          <Heading level={2}>Where it ends up</Heading>
          {where.live ? (
            <WhereItGoes liveBase={where.liveBase} hidden={false} className="text-graphite" />
          ) : (
            <Text as="p" color="secondary" data-where="later">
              {whereAPublishedExhbtGoes(portfolioHost("yourname"))} {where.reason}
            </Text>
          )}
          <Text as="p" type="supporting">
            The picture is an example: {demoOwner.name} and her project are made up.
          </Text>
          <Link href={`/demo/${example.slug}`} isStandalone color="primary" weight="semibold" hasUnderline>
            Open the example
          </Link>
        </VStack>
        <Preview
          url={portfolioUrl(demoOwner.username, example.slug)}
          label={`An example exhbt by ${demoOwner.name}, as it looks on her portfolio: ${example.doc.title}`}
          crop="max-h-64"
          className="add-example"
        >
          <ProjectView doc={example.doc} owner={{ name: demoOwner.name, photoUrl: null, bio: demoOwner.headline }} checkedOn={example.checkedOn} headingLevel="h2" />
        </Preview>
      </Grid>
    </Section>
  );
}

/** No room on the plan for another exhbt: the upgrade offer, as the list of exhbts shows it. */
export function NoRoom({ reason, upgradeTo }: { reason: string; upgradeTo?: Plan }) {
  return (
    <AddFrame>
      <VStack gap={3} hAlign="start">
        <Back href="/exhbts">Your exhbts</Back>
        <Heading level={1}>Add an exhbt</Heading>
      </VStack>
      <VStack className="max-w-2xl">
        <UpgradePrompt reason={reason} upgradeTo={upgradeTo} />
      </VStack>
    </AddFrame>
  );
}
