import Link from "next/link";
import { Mark } from "./Logo";

export const CHECKS_GUIDE = "/how-to-read-an-exhbt#checks";

/**
 * The exhbt seal: our mark plus "checked by exhbt". It says the checks ran, not
 * that the results are true, so the wording stays "checked", never "verified".
 * As a link it explains itself on the employer guide. Inside another link (a
 * tile), pass `asLink={false}` so links don't nest.
 */
export function Seal({
  date,
  asLink = true,
  compact = false,
  href = CHECKS_GUIDE,
}: {
  date?: string;
  asLink?: boolean;
  compact?: boolean;
  /** The guide. On a portfolio host pass the marketing site's full address: a relative link would stay on the person's host. */
  href?: string;
}) {
  const body = (
    <>
      <Mark size={compact ? 14 : 16} />
      <span>{compact ? "checked" : "checked by exhbt"}</span>
      {date && <span className="text-slate">· {date}</span>}
    </>
  );
  const cls =
    "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pr-2.5 pl-1.5 font-mono text-[0.72rem] text-ink";
  return asLink ? (
    <Link href={href} className={`${cls} hover:border-jade`} aria-label="Checked by exhbt: what the checks mean">
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
