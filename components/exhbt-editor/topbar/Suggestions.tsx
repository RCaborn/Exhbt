"use client";

import type { ReactNode } from "react";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Lightbulb } from "lucide-react";
import { labelOf } from "@/components/editor/model";
import type { FieldPath } from "@/components/portfolio/page-ctx";
import { useSuggestions } from "../context";
import { useDoc } from "../store";

/**
 * "Suggestions" (decision 0032): what a page of this layout usually has and this one lacks, and a flowchart
 * or a set of findings shorter than most (suggestionsFor in lib/exhbt/blocks.ts). They are advice. None of
 * them stops publishing, counts in "things to fix" or marks a field, and the words under the list say so.
 * Each one, pressed, goes to where it could be acted on (`onPick`, with the path a jump takes).
 *
 * Drawn in "Things to fix" and in "Review and publish", so it is one component, and Astryx's: a List of
 * rows with its own heading, each row a button.
 */
export function Suggestions({ onPick }: { onPick(path: FieldPath): void }): ReactNode {
  const suggestions = useSuggestions();
  const doc = useDoc((d) => d);
  if (suggestions.length === 0) return null;
  return (
    <div className="xe-suggest" data-suggestions>
      <VStack gap={1}>
        <List header="Suggestions" density="compact" edge="flush">
          {suggestions.map((s) => {
            // Where it is about, when that is one part of the page ("Flowchart", "My role"): the "+" at the end of the page needs no name.
            const about = s.path === "sections" ? "" : labelOf(s.path, doc);
            return (
              <ListItem
                key={`${s.path}|${s.message}`}
                label={s.message}
                description={about || undefined}
                align="first-line"
                startContent={<Lightbulb aria-hidden size={16} strokeWidth={2.25} />}
                onClick={() => onPick(s.path as FieldPath)}
              />
            );
          })}
        </List>
        <Text type="supporting" as="p">
          Up to you. None of these stops you publishing.
        </Text>
      </VStack>
    </div>
  );
}
