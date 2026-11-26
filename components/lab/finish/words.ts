/**
 * What the finish screen's states say and point at, worked out on the server (the page) from where
 * the product keeps each fact, and handed to the browser parts as one object.
 */
export type FinishWords = {
  /** The exhbt's title, the question. */
  title: string;
  /** The person's first name, for "Confirmed by Amara". */
  first: string;
  /** The name in her address. */
  name: string;
  /** Her address: amara.exhbt.co.uk. */
  host: string;
  /** The exhbt's own link, without https:// (amara.exhbt.co.uk/gp-reminders). */
  link: string;
  /** The link after the host ("/gp-reminders"). */
  path: string;
  /** liveLine (lib/exhbt/publish-words.ts): after a first publish, and after publishing changes. */
  liveLine: string;
  changedLine: string;
  /** When the checks ran, as the page prints it. */
  checkedOn: string;
  /** The file the work is attached as, if any. */
  evidence: string | null;
  /** The live exhbt, for "View it" (the sample's own page, /demo/<slug>). */
  viewHref: string;
  /** "Your portfolio", "Add your next exhbt" and "Open it in the editor": the lab's own states. */
  portfolioHref: string;
  nextHref: string;
  editorHref: string;
  /** The app's own host (lib/hosts.ts), for the address bar of a page only its owner sees. */
  appHost: string;
  /** The link preview: the real picture (preview.png) and what the apps print under it. */
  preview: { src: string; alt: string; title: string; description: string };
  /** On Free: why it can't go out, what the upgrade gives, and its button. */
  free: { reason: string; address: string; plan: string; upgrade: string; exampleHost: string };
};
