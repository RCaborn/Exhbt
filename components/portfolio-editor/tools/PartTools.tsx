"use client";

import type { ReactNode } from "react";

/*
 * STUB (brief E, milestone 1). Brief G takes this file over: the corner toolbar of a part with no frame
 * of its own, drawn over it and taking no room. "intro": Suggest an intro, the last child of
 * `[data-intro]`, which is `relative` while editing. "contact": Your links, a grid child of Get in
 * touch, which is `relative` while editing, so it must be absolute. The fields of "Your links" carry
 * their `data-path` (LINK_PATHS in ../paths.ts), so a problem's "Show me" finds them once
 * `open("links")` has drawn them. Until then it draws nothing.
 */
export function PartTools(props: { where: "intro" | "contact" }): ReactNode {
  void props;
  return null;
}
