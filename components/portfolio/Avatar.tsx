/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */

/** The person's photo, or their initials on mint when there isn't one. */
export function Avatar({ name, photoUrl, size = 56 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const style = { width: size, height: size };
  if (photoUrl) {
    return <img src={photoUrl} alt="" width={size} height={size} style={style} className="shrink-0 rounded-full border border-line object-cover" />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: size * 0.36 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-ink bg-mint font-bold text-ink"
    >
      {initials || "?"}
    </span>
  );
}
