import { Avatar } from "@/components/portfolio/Avatar";
import type { Teammate } from "@/lib/team-rules";

/**
 * Teammates on a team project (decision 0013): small photos, names and roles. A byline, not
 * part of the exhbt, so none of it counts towards the word cap. Nothing about file matches
 * ever shows here.
 */

/** On the project page, under the author: each name links to their portfolio when they have a public one. */
export function TeamByline({ team }: { team: Teammate[] }) {
  if (!team.length) return null;
  return (
    <div data-team className="mt-4 break-inside-avoid rounded-[12px] border border-line px-4 py-3 print:mt-3">
      <p id="team-label" className="text-[0.8125rem] font-semibold text-graphite">
        Team project with
      </p>
      <ul aria-labelledby="team-label" className="mt-2 flex flex-wrap gap-x-5 gap-y-2.5">
        {team.map((t) => (
          <li key={t.userId} className="flex items-center gap-2">
            <Avatar name={t.name} photoUrl={t.photoUrl} size={28} />
            <span className="leading-tight">
              {t.href ? (
                <a href={t.href} className="link text-sm font-semibold text-ink">
                  {t.name}
                </a>
              ) : (
                <span className="text-sm font-semibold">{t.name}</span>
              )}
              {t.role && <span className="block text-[0.8125rem] text-graphite">{t.role}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** On a portfolio tile, which is itself a link: names and roles as text, no links inside it. */
export function TeamLine({ team }: { team: Teammate[] }) {
  if (!team.length) return null;
  const shown = team.slice(0, 3);
  const more = team.length - shown.length;
  return (
    <div data-team className="mt-4 flex items-center gap-2">
      <span aria-hidden className="flex shrink-0 -space-x-1.5">
        {shown.map((t) => (
          <Avatar key={t.userId} name={t.name} photoUrl={t.photoUrl} size={22} />
        ))}
      </span>
      <p className="text-[0.8125rem] leading-snug text-graphite">
        Team project with{" "}
        {shown.map((t, i) => (
          <span key={t.userId}>
            {i > 0 && (i === shown.length - 1 && !more ? " and " : ", ")}
            <span className="font-semibold text-ink">{t.name}</span>
            {t.role && ` (${t.role})`}
          </span>
        ))}
        {more > 0 && ` and ${more} more`}
      </p>
    </div>
  );
}
