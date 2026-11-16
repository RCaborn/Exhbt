import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/Button";
import { getStore, type ExhbtRecord } from "@/lib/store";
import { canDraftInto, displayNameFor, teamFilesFor, teamFor } from "@/lib/team";
import { namesList } from "@/lib/team-rules";

/**
 * A slim line under the editor's heading (decision 0013): who the project is with and a link to the
 * Teammates page, or an offer to add some. On a teammate's own, still empty exhbt it offers the
 * team project's files to draft from.
 */
export async function TeamStrip({ exhbt, userId, skipped = 0 }: { exhbt: ExhbtRecord; userId: string; skipped?: number }) {
  // Drawn inside the editor, under its heading (the editor gives it the page width).
  const host = (await headers()).get("host");
  const team = await teamFor(exhbt, host);
  const files = exhbt.teamOf && canDraftInto(exhbt, userId) ? await teamFilesFor(userId, exhbt.id) : [];
  const root = files.length && exhbt.teamOf ? await getStore().getExhbt(exhbt.teamOf) : null;
  const from = root ? await displayNameFor(root.userId, "Your team") : "Your team";

  return (
    <div>
      <div className="space-y-3">
        <section aria-label="Team" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[16px] border border-line bg-surface px-4 py-3" data-team-strip>
          <p className="text-sm">
            {team.length ? (
              <>
                Team project with <span className="font-semibold">{namesList(team.map((t) => t.name))}</span>.
              </>
            ) : (
              "Worked on this with other people? Add them as teammates."
            )}
          </p>
          <Link href={`/exhbts/${exhbt.id}/team`} className="link text-sm font-semibold text-ink">
            {team.length ? "Teammates" : "Add teammates"}
          </Link>
        </section>
        {files.length > 0 && (
          <section aria-labelledby="team-files" className="rounded-[16px] border border-line bg-surface px-4 py-4">
            <h2 id="team-files" className="text-[1.125rem]">
              Draft your own exhbt from the team&apos;s files
            </h2>
            <p className="mt-1 text-sm text-graphite">
              {from}&apos;s project {files.length === 1 ? "file is" : "files are"} in your storage now:{" "}
              {files.map((f) => f.path.split("/").pop()).join(", ")}. Nothing they wrote was copied; this exhbt is yours to write.
            </p>
            <div className="mt-3">
              <Button href={`/exhbts/new?into=${exhbt.id}`} size="sm">
                Draft from these files
              </Button>
            </div>
          </section>
        )}
        {skipped > 0 && (
          <p role="status" className="text-sm text-graphite">
            {skipped === 1 ? "One of the project's files" : `${skipped} of the project's files`} didn&apos;t fit in your plan&apos;s storage, so{" "}
            {skipped === 1 ? "it wasn't" : "they weren't"} copied.
          </p>
        )}
      </div>
    </div>
  );
}
