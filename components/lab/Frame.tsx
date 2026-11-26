import { BrowserFrame } from "@/components/home/BrowserFrame";
import { Preview } from "@/components/home/Preview";
import { PersonPage } from "./LabFrame";

/**
 * The work, raised: a person's page in the site's real browser frame (BrowserFrame, through
 * Preview), which is the one thing in the flow of a lab page that casts a shadow.
 *
 * The frame is the site's chrome, so the lab's root gives it the theme's container radius and
 * high shadow (lab.css, [data-lab-frame]); the page inside is the person's own, so PersonPage puts
 * it back under the production theme and the site's tokens, and nothing in the lab restyles it.
 *
 * By default it is a picture, as on Home: inert and hidden from screen readers, with `label`
 * saying what it shows. `live` makes the page inside real (it can be clicked and read), for a
 * screen where the page is the thing being worked on.
 *
 * `page` styles the page inside the window: a CSS `zoom` draws a wide page smaller while it still
 * lays out wide (`[zoom:0.7]`), and padding goes here too. `crop` gives the window a fixed height,
 * like a browser showing the first screen (`max-h-[36rem]`).
 */
export function Frame({
  url,
  label,
  children,
  page = "",
  crop = "",
  live = false,
  className = "",
}: {
  /** The address in the frame's bar. A person's is name.exhbt.co.uk (lib/hosts.ts). */
  url: string;
  /** What the picture shows, for screen readers. */
  label: string;
  children: React.ReactNode;
  page?: string;
  crop?: string;
  live?: boolean;
  /** On the frame's own wrapper: its width, its place in a grid. */
  className?: string;
}) {
  if (live) {
    return (
      <div data-lab-frame className={className}>
        <BrowserFrame url={url}>
          <div className={`overflow-hidden ${crop}`}>
            <PersonPage className={page}>{children}</PersonPage>
          </div>
        </BrowserFrame>
      </div>
    );
  }
  return (
    <div data-lab-frame className={className}>
      <Preview url={url} label={label} crop={crop}>
        <PersonPage className={page}>{children}</PersonPage>
      </Preview>
    </div>
  );
}
