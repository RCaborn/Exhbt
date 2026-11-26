import type { ReactNode } from "react";
import { EmptyState } from "@astryxdesign/core/EmptyState";

/** Astryx EmptyState with the app's rule built in: a title that says what is empty, and exactly one next step. */
export function Empty({ title, body, picture, action, headingLevel = 2 }: { title: string; body?: string; picture?: ReactNode; action: ReactNode; headingLevel?: 2 | 3 }) {
  return <EmptyState title={title} description={body} icon={picture} actions={action} headingLevel={headingLevel} />;
}
