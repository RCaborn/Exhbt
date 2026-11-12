import Link from "next/link";
import { createFromIdea } from "@/app/(app)/exhbts/[id]/actions";
import { Button } from "@/components/ui/Button";

/** What the Projects view knows about building an idea as an exhbt (null when Phase 2 is off). */
export type BuildState =
  | { state: "signed-out" }
  | { state: "ok" }
  | { state: "full"; reason: string };

/**
 * "Build this as an exhbt" under a project idea: starts an exhbt prefilled from the idea and
 * opens the editor. Signed out it says to sign in (and comes back here); when the plan is full
 * it gives the reason and a way to upgrade. `inForm` is for ideas drawn inside another form
 * (the plan editor), where a nested form isn't allowed.
 */
export function BuildThis({ build, roadmapId, ideaId, title, inForm = false }: { build: BuildState; roadmapId: string; ideaId: string; title: string; inForm?: boolean }) {
  if (build.state === "signed-out") {
    const next = encodeURIComponent(`/roadmap/${roadmapId}?view=projects`);
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
  const action = createFromIdea.bind(null, roadmapId, ideaId);
  const label = `Build this as an exhbt: ${title}`;
  if (inForm) {
    return (
      <Button type="submit" size="sm" formAction={action} label={label}>
        Build this as an exhbt
      </Button>
    );
  }
  return (
    <form action={action}>
      <Button type="submit" size="sm" label={label}>
        Build this as an exhbt
      </Button>
    </form>
  );
}
