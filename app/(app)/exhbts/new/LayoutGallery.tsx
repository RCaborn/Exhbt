import { ArrowRight } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { createFromScratch } from "@/app/(app)/exhbts/[id]/actions";
import { Button } from "@/components/ui/Button";
import { ADD_EXHBT, DRAFT_WITH_AI } from "@/lib/add-exhbt";
import { FORMAT_RULES, LAYOUT_NOT_OFFERED, type Format } from "@/lib/exhbt/formats";
import { AddFrame, Back } from "./Chooser";
import { LayoutLine, LayoutSketch } from "./layout-parts";

/**
 * "Build it yourself": the layouts the person's editor offers, each with the sketch and the line the
 * editor's layout menu draws. One form; each layout is an Astryx Card whose one control is a real submit
 * button carrying the layout, its press area stretched over the card by the stylesheet. Pressing one makes
 * an empty exhbt in that layout and opens the editor (createFromScratch, which checks the layout again).
 *
 * `canDraft`: the person has an AI draft left, so the note at the end can offer it to someone who can't decide.
 */
export function LayoutGallery({ offered, refused, canDraft }: { offered: readonly Format[]; refused: boolean; canDraft: boolean }) {
  return (
    <AddFrame>
      <VStack gap={3} hAlign="start">
        <Back href={ADD_EXHBT}>Add an exhbt</Back>
        <Heading level={1}>Choose a layout</Heading>
        <Text as="p" type="large" weight="normal" color="secondary" className="max-w-3xl">
          Choose one and you land on an empty page in that layout, ready to type on.
        </Text>
      </VStack>
      {refused && <Banner status="error" title={LAYOUT_NOT_OFFERED} />}
      <form action={createFromScratch}>
        <Grid columns={{ minWidth: 220, max: 4 }} gap={5}>
          {offered.map((f) => {
            const name = FORMAT_RULES[f].name;
            return (
              <div key={f} className="add-cell">
                <Card className="add-layout" padding={4} data-layout={f}>
                  <div className="add-layout-body">
                    <div className="add-layout-art" aria-hidden>
                      <LayoutSketch format={f} className="add-sketch" />
                    </div>
                    <Heading level={3} accessibilityLevel={2} className="add-layout-name">
                      {name}
                    </Heading>
                    <Text as="p" type="supporting" className="add-layout-line">
                      <LayoutLine format={f} />
                    </Text>
                    <Button type="submit" name="layout" value={f} size="sm" label={`Use the ${name} layout`} className="add-go">
                      <ArrowRight aria-hidden size={16} strokeWidth={2.25} />
                    </Button>
                  </div>
                </Card>
              </div>
            );
          })}
          <VStack gap={2} padding={4} vAlign="center">
            <Heading level={3} accessibilityLevel={2}>
              Not sure which?
            </Heading>
            <Text as="p" color="secondary">
              Take the closest. You can switch layout in the editor and keep everything you&apos;ve written.
            </Text>
            {canDraft && (
              <Text as="p" color="secondary">
                Or upload your project and the AI chooses one for you.{" "}
                <Link href={DRAFT_WITH_AI} color="primary" hasUnderline>
                  Draft it with AI
                </Link>
              </Text>
            )}
          </VStack>
        </Grid>
      </form>
    </AddFrame>
  );
}
