import type { ExhbtDoc, Issue } from "../../lib/exhbt/blocks";
import { FORMAT_RULES, formatOf, type Format } from "../../lib/exhbt/formats";

/**
 * The draft eval's marks for the layouts (decision 0028): whether a draft chose the layout its
 * answer key expects, and which of its publish issues no draft could have cleared. Pure, so
 * e2e/layouts-new.spec.ts tests it without running the eval; scripts/eval-drafts.ts is its only
 * other reader. Whether a draft holds only what its material does (a pull quote, a source, a role, a
 * link) is unsupportedParts in lib/exhbt/references.ts: the checks toDoc itself uses.
 */

/** The layout an answer key expects (`expect.layout`): one, or a list where more than one is right. */
export type LayoutExpect = Format | Format[];

export type LayoutMark = {
  /** n/a: the answer key names no layout, so the choice is shown and not marked. */
  state: "ok" | "wrong" | "n/a";
  got: Format;
  want: Format[];
};

/** The draft's layout against the answer key's. */
export function markLayout(doc: Pick<ExhbtDoc, "format">, want: LayoutExpect | undefined): LayoutMark {
  const got = formatOf(doc);
  const wanted = want === undefined ? [] : Array.isArray(want) ? want : [want];
  return { state: wanted.length === 0 ? "n/a" : wanted.includes(got) ? "ok" : "wrong", got, want: wanted };
}

/**
 * A publish issue that says nothing about the draft, because only the person can clear it: the
 * pictures a layout needs (a gallery's two, a before and after's two, an event's one, a build's
 * screenshot when the material gives no link either) and the Before and After marks. No picture is
 * ever drafted and no mark is ever set (decision 0028), so these are left out of the limits score.
 * My role is not one of them: an event's material is expected to say it.
 */
export function needsThePerson(issue: Issue, doc: Pick<ExhbtDoc, "format">): boolean {
  if (issue.path !== "sections") return false;
  return FORMAT_RULES[formatOf(doc)].needs.some(
    (n) => n.message === issue.message && (n.need === "stages" || (n.need === "count" && n.kinds.every((k) => k === "image" || k === "link"))),
  );
}
