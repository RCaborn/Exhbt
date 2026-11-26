/**
 * "Add an exhbt" (/exhbts/new) and its two ways to start. The addresses are written here once, so the
 * page, the links into it, the server action and the tests agree.
 *
 * With nothing after it, the address opens the chooser. An address that already says what is being
 * drafted skips the chooser: `?start=draft` is the upload form the AI drafts from ("Draft it from my files"), and so is
 * `?into=<id>` (a teammate drafting their own exhbt from a team project, decision 0013).
 * `?start=blank` is the layouts to start an empty exhbt in ("Write it myself").
 */
export const ADD_EXHBT = "/exhbts/new";
export const DRAFT_WITH_AI = `${ADD_EXHBT}?start=draft`;
export const BUILD_IT_YOURSELF = `${ADD_EXHBT}?start=blank`;
/** Back on the layouts after the server refused the one asked for (createFromScratch). */
export const LAYOUT_REFUSED = `${BUILD_IT_YOURSELF}&refused=1`;

export type AddExhbtView = "choose" | "draft" | "blank";

/** Which of the three screens an address asks for. */
export function addExhbtView(q: { into?: string; start?: string }): AddExhbtView {
  if (q.into || q.start === "draft") return "draft";
  return q.start === "blank" ? "blank" : "choose";
}
