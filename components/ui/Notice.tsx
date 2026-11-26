import type { ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";

/**
 * A message on the page: an Astryx Banner inside a live region, because Banner is not live by itself and the
 * site's screens and tests rely on role="status" and role="alert".
 * `live` defaults to "polite" for info and success and "assertive" for warning and error; "off" for a message
 * that is there when the page loads.
 */
export function Notice({
  status,
  title,
  children,
  action,
  dismissable,
  container = "card",
  live,
}: {
  status: "info" | "success" | "warning" | "error";
  title: string;
  children?: ReactNode;
  /** One action, at the end. */
  action?: ReactNode;
  dismissable?: boolean;
  /** "section" runs the full width under a bar; "card" sits in the flow. */
  container?: "card" | "section";
  live?: "polite" | "assertive" | "off";
}): ReactNode {
  const mode = live ?? (status === "warning" || status === "error" ? "assertive" : "polite");
  const banner = <Banner status={status} title={title} description={children} endContent={action} isDismissable={dismissable} container={container} />;
  if (mode === "off") return <div>{banner}</div>;
  return <div role={mode === "assertive" ? "alert" : "status"}>{banner}</div>;
}
