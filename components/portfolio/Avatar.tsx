/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */

/** The person's photo, or their initials on mint when there isn't one. */
export function Avatar({ name, photoUrl, size = 56, shape = "round" }: { name: string; photoUrl?: string | null; size?: number; shape?: "round" | "square" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const style = { width: size, height: size };
  const corners = shape === "round" ? "rounded-full" : "rounded-[22%]";
  if (photoUrl) {
    return <img src={photoUrl} alt="" width={size} height={size} style={style} data-avatar="photo" className={`shrink-0 ${corners} border border-line object-cover`} />;
  }
  return (
    <span
      aria-hidden
      data-avatar="initials"
      style={{ ...style, fontSize: size * 0.36 }}
      className={`inline-flex shrink-0 items-center justify-center ${corners} border border-ink bg-mint font-bold text-ink`}
    >
      {initials || "?"}
    </span>
  );
}
