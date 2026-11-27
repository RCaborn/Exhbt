import Link from "next/link";
import { createFromIdea, createFromSavedIdea } from "@/app/(app)/exhbts/[id]/actions";
import { Button } from "@/components/ui/Button";

/**
 * What the Projects view knows about building an idea as an exhbt (null when Phase 2 is off).
 * `portfolioFirst` is set when the portfolio switch is at "page" (lib/portfolio-kind.ts, decision 0031):
 * the button then says "Add as an exhbt", since the exhbt goes on the person's portfolio.
 */
export type BuildState = (
  | { state: "signed-out" }
  | { state: "ok" }
  | { state: "full"; reason: string }
) & { portfolioFirst?: true };

/**
 * "Build this as an exhbt" under a project idea: starts an exhbt prefilled from the idea and
 * opens the editor. Signed out it says to sign in (and comes back here); when the plan is full
 * it gives the reason and a way to upgrade. `inForm` is for ideas drawn inside another form
 * (the plan editor), where a nested form isn't allowed.
 */
export function BuildThis({
  build,
  roadmapId,
  ideaId,
  savedId,
  title,
  inForm = false,
}: {
  build: BuildState;
  /** The idea's roadmap and its id there; left out when building from the saved list. */
  roadmapId?: string;
  ideaId?: string;
  /** A saved idea's id (the saved list), instead of a roadmap's idea. */
  savedId?: string;
  title: string;
  inForm?: boolean;
}) {
  if (build.state === "signed-out") {
    const next = encodeURIComponent(savedId ? "/roadmap/saved" : `/roadmap/${roadmapId}?view=projects`);
    return (
      <Button href={`/login?next=${next}`} size="sm" label={`Sign in to build this: ${title}`}>
        Sign in to build this
      </Button>
    );
  }
  if (build.state === "full") {
    return (
      <p className="text-sm text-graphite">
        {build.reason}{" "}
        <Link href="/account/billing" className="link font-semibold text-ink">
          See plans
        </Link>
      </p>
    );
  }
  const action = savedId ? createFromSavedIdea.bind(null, savedId) : createFromIdea.bind(null, roadmapId ?? "", ideaId ?? "");
  const words = build.portfolioFirst ? "Add as an exhbt" : "Build this as an exhbt";
  const label = build.portfolioFirst ? `Add to your portfolio as an exhbt: ${title}` : `Build this as an exhbt: ${title}`;
  if (inForm) {
    return (
      <Button type="submit" size="sm" formAction={action} label={label}>
        {words}
      </Button>
    );
  }
  return (
    <form action={action}>
      <Button type="submit" size="sm" label={label}>
        {words}
      </Button>
    </form>
  );
}
