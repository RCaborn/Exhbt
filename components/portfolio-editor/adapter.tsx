"use client";

import { isValidElement, memo, useMemo, type ReactNode } from "react";
import type { HomeEdit, HomeSectionSlot, HomeTileSlot } from "@/components/portfolio/home-ctx";
import { featuredOf, workProjects, type HomeProps } from "@/components/portfolio/PortfolioHome";
import type { SectionKey } from "@/lib/portfolio-layout";
import { ParasField } from "./fields/ParasField";
import { TextField } from "./fields/TextField";
import { useRenderCount } from "./renders";
import { SectionFrame } from "./sections/SectionFrame";
import { PhotoButton } from "./sheets/PhotoButton";
import { LineTools } from "./tiles/LineTools";
import { OwnerParts } from "./tiles/OwnerParts";
import { TileFrame } from "./tiles/TileFrame";
import { PartTools } from "./tools/PartTools";

/*
 * The portfolio editor's adapter (decision 0031, "The adapter"): what `PortfolioHome` is given as `edit`.
 * The page asks it for each part's editing version, and it answers with the editor's own parts: the
 * fields (E), the frames, the lines' controls and the owner's parts (F), the photo button and the part
 * tools (G). One stable object for the editor's life, so the page's memoised parts stay memoised.
 *
 * What it adds of its own is what keeps typing cheap. `PortfolioHome` is drawn again whenever the state
 * changes (it is plain markup: decision 0031, "Not sure, and risky"), which draws the hero again; but
 * each section is handed to a boundary (`SectionSlot`) that is drawn again only when what that section
 * is made from has changed. So a key typed in About me draws About me, and no other section, tile or
 * chart. The units are counted for the smoothness checks (renders.ts).
 */

/** The props the page gives a section: its own, and which section it is. */
type SectionProps = HomeProps & { sectionKey: SectionKey };

/**
 * Whether a section is made from the same things as when it was last drawn. It reads the props the page
 * gave the section, and anything it does not know is compared as it is, so a prop the page starts
 * passing tomorrow redraws every section until this says otherwise: the safe way to be wrong. What it
 * knows is which sections read which parts of the person, the words, the sections and the exhbts.
 */
function sameSection(key: SectionKey, a: SectionProps, b: SectionProps): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof SectionProps>;
  for (const k of keys) {
    if (Object.is(a[k], b[k])) continue;
    switch (k) {
      // Only Get in touch draws the person: their links.
      case "person":
        if (key !== "contact" || sameLinks(a.person.links, b.person.links)) continue;
        return false;
      case "tiles":
        if (sameTiles(key, a.tiles, b.tiles)) continue;
        return false;
      // Only the work reads the sections: its heading says "More of my work" when the band is on the page.
      case "sections":
        if (key !== "work" || a.sections.includes("featured") === b.sections.includes("featured")) continue;
        return false;
      case "projects":
      case "featuredId":
        if (key === "featured" && featuredOf(a) === featuredOf(b)) continue;
        if (key === "work" && sameList(workProjects(a), workProjects(b))) continue;
        if (key !== "featured" && key !== "work") continue;
        return false;
      default:
        return false;
    }
  }
  return true;
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function sameLinks(a: HomeProps["person"]["links"], b: HomeProps["person"]["links"]): boolean {
  return a?.linkedin === b?.linkedin && a?.github === b?.github && a?.website === b?.website && a?.email === b?.email;
}

function sameTiles(key: SectionKey, a: HomeProps["tiles"], b: HomeProps["tiles"]): boolean {
  switch (key) {
    case "about":
      return a.about === b.about && a.education === b.education;
    case "experience":
      return a.experience === b.experience;
    case "quote":
      return a.quote === b.quote;
    // Get in touch fills any gap in the person's links from a links tile the old customiser saved.
    case "contact":
      return a.links === b.links;
    case "featured":
    case "work":
      return true;
  }
}

type SlotProps = Omit<HomeSectionSlot, "key"> & { sectionKey: SectionKey; node: ReactNode };

/** A section in its frame, drawn again only when its place or what it is made from changes. */
const SectionSlot = memo(
  function SectionSlot({ sectionKey, index, count, node }: SlotProps): ReactNode {
    useRenderCount(`section:${sectionKey}`);
    return (
      <SectionFrame sectionKey={sectionKey} index={index} count={count}>
        {node}
      </SectionFrame>
    );
  },
  (a, b) => {
    if (a.sectionKey !== b.sectionKey || a.index !== b.index || a.count !== b.count) return false;
    // The page hands over the section as an element: its props are what it will be drawn from.
    if (!isValidElement<SectionProps>(a.node) || !isValidElement<SectionProps>(b.node) || a.node.type !== b.node.type) return false;
    return sameSection(a.sectionKey, a.node.props, b.node.props);
  },
);

/** An exhbt in its frame. Counted, so the smoothness checks can say no tile was drawn again. */
function TileSlot({ node, ...s }: HomeTileSlot & { node: ReactNode }): ReactNode {
  useRenderCount(`tile:${s.id}`);
  return <TileFrame {...s}>{node}</TileFrame>;
}

/** The face with its button. Every hero draws exactly one, so its renders are the hero's. */
function HeroPhoto({ face }: { face: ReactNode }): ReactNode {
  useRenderCount("hero");
  return <PhotoButton>{face}</PhotoButton>;
}

/** The adapter: one stable object for the editor's life. */
export function useAdapter(): HomeEdit {
  return useMemo<HomeEdit>(
    () => ({
      text: (s) => <TextField {...s} />,
      paras: (s) => <ParasField {...s} />,
      photo: (face) => <HeroPhoto face={face} />,
      section: (s, node) => <SectionSlot sectionKey={s.key} index={s.index} count={s.count} node={node} />,
      tile: (s, node) => <TileSlot {...s} node={node} />,
      lineTools: (s) => <LineTools {...s} />,
      owner: (where) => <OwnerParts where={where} />,
      tools: (where) => <PartTools where={where} />,
    }),
    [],
  );
}
