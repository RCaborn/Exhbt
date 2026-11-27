"use client";

import { ArrowLeft, ArrowRight, CornerDownRight, FileText, Image as Picture, Link2, Presentation } from "lucide-react";
import { Icon } from "@astryxdesign/core/Icon";

/*
 * The icons on "Add an exhbt", drawn through Astryx's Icon so their sizes and colours are the theme's, not
 * numbers written here. The drawings are the site's own icon set. Icon is client code and takes the drawing
 * as a component, which a server page can't hand over, so the page names a glyph and this file holds them.
 */
const GLYPHS = {
  back: ArrowLeft,
  go: ArrowRight,
  next: CornerDownRight,
  report: FileText,
  slides: Presentation,
  picture: Picture,
  link: Link2,
};

export type GlyphName = keyof typeof GLYPHS;

/** A decorative icon: the words beside it carry the meaning. */
export function Glyph({ name, size = "sm", color, className }: { name: GlyphName; size?: "xsm" | "sm" | "md" | "lg"; color?: "primary" | "secondary" | "inherit"; className?: string }) {
  return <Icon icon={GLYPHS[name]} size={size} color={color} className={className} />;
}
