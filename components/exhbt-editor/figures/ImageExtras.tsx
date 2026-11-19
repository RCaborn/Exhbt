"use client";

import type { ReactNode } from "react";
import type { ExtraSlot } from "@/components/portfolio/page-ctx";
import { InlineText } from "../fields/InlineText";
import { useFrame } from "../Frame";
import { DESCRIPTION_PLACEHOLDER, descriptionClass, descriptionLabel } from "../geometry";
import { useDoc, useSection } from "../store";

/*
 * An image's edit-only parts (decision 0026): "above", the picked-figure label over the picture's top;
 * "below", the description field, in the flow under the picture and its caption, one of the two
 * edit-only fields 0026 keeps in the flow. J's: this is G's stub, which draws the description field
 * (id image-N-alt, N its place among the images from 0, as the classic editor's) and nothing above.
 */
export function ImageExtras(props: ExtraSlot): ReactNode {
  if (props.where !== "below") return null;
  return <Description sectionId={props.sectionId} />;
}

function Description({ sectionId }: { sectionId: string }) {
  const frame = useFrame();
  const s = useSection(sectionId);
  const n = useDoc((d) => d.sections.filter((x) => x.kind === "image").findIndex((x) => x.id === sectionId));
  const index = useDoc((d) => d.sections.findIndex((x) => x.id === sectionId));
  const alt = s?.kind === "image" ? s.alt : "";
  return (
    <span data-edit-only="image-description" className={descriptionClass(frame?.as)}>
      <InlineText path={`sections.${index}.alt`} value={alt} label={descriptionLabel(n + 1)} placeholder={DESCRIPTION_PLACEHOLDER} id={`image-${n}-alt`} />
    </span>
  );
}
