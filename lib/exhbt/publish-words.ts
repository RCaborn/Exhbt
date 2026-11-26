/**
 * What the publish step says about the portfolio, in both editors (components/editor/PublishWhere.tsx). Rory and Alex,
 * 25 Nov 2026, found it unclear what publishing does: "Am I publishing this one exhbt, or my portfolio?" Publishing
 * puts one exhbt on the person's portfolio, at a link of its own. Pure, so the tests can read it.
 */

/** The portfolio's address as a person reads it: "rory.exhbt.co.uk" on the live site, "/p/rory" in development. */
export const portfolioAddress = (liveBase: string): string => liveBase.replace(/^https:\/\//, "");

/**
 * The first line after publishing. An exhbt the person has hidden from the portfolio's home page (decision 0014) is
 * live at its own link, not on the home page, so it says that instead.
 */
export const liveLine = (changed: boolean, hidden: boolean): string => `${changed ? "Your changes are live" : "It's live"}${hidden ? " at its own link" : " on your portfolio"}.`;
