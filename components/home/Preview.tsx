import { BrowserFrame } from "./BrowserFrame";

/**
 * A real product page shown as a picture on a marketing page: the component itself (ProjectView,
 * PortfolioHome) with fictional data, in a browser frame at its address. It is a picture, so it is
 * inert and hidden from screen readers; `label` says what it shows, and the page it pictures is a
 * link away (the demo).
 *
 * `className` sizes it: a CSS `zoom` draws a wide page smaller in a narrow column while it still
 * lays out at the wider width (its container queries read the unzoomed size). Without one it
 * renders at its real size, laid out for the room it has, as a phone visitor would see it. `crop`
 * gives it a fixed height, like a browser window showing the first screen.
 */
export function Preview({
  url,
  label,
  children,
  crop = "",
  className = "",
}: {
  url: string;
  /** What the picture shows, for screen readers. */
  label: string;
  children: React.ReactNode;
  /** The visible window: a height crops it, like a browser showing the first screen. */
  crop?: string;
  /** On the page inside the window: its zoom and padding. */
  className?: string;
}) {
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="sr-only">{label}</figcaption>
      <BrowserFrame url={url}>
        <div inert aria-hidden className={`overflow-hidden ${crop}`}>
          <div className={className}>{children}</div>
        </div>
      </BrowserFrame>
    </figure>
  );
}
