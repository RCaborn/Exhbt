import Link from "next/link";

/**
 * The exhbt mark (brand kit v1, the Frame route): viewfinder brackets put one piece of work
 * in focus, and the dot is the evidence. A mint tile with ink brackets on white and on ink;
 * on a mint background pass `tone="on-mint"` and the colours flip so it never disappears.
 * Rules in docs/brand.md.
 */
export function Mark({
  size = 24,
  tone = "default",
  className = "",
}: {
  size?: number;
  tone?: "default" | "on-mint";
  className?: string;
}) {
  const tile = tone === "on-mint" ? "var(--color-ink)" : "var(--color-mint)";
  const line = tone === "on-mint" ? "var(--color-mint)" : "var(--color-ink)";
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 220 220" className={`shrink-0 ${className}`} focusable="false">
      <rect width="220" height="220" rx="55" fill={tile} />
      <path
        d="M50 100V65a15 15 0 0 1 15-15h35M170 120v35a15 15 0 0 1-15 15h-35"
        fill="none"
        stroke={line}
        strokeWidth="20"
        strokeLinecap="round"
      />
      <circle cx="110" cy="110" r="16" fill={line} />
    </svg>
  );
}

const SIZES = {
  sm: { mark: 20, text: "text-[1.2rem]", gap: "gap-1.5" },
  md: { mark: 28, text: "text-[1.65rem]", gap: "gap-2" },
  lg: { mark: 40, text: "text-[2.4rem]", gap: "gap-2.5" },
} as const;

/** Mark plus the lower-case wordmark. Pass `href` to make it a link home. */
export function Logo({
  size = "md",
  href,
  className = "",
}: {
  size?: keyof typeof SIZES;
  href?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const body = (
    <>
      <Mark size={s.mark} />
      <span className="translate-y-[-0.04em]">exhbt</span>
    </>
  );
  const cls = `inline-flex items-center ${s.gap} ${s.text} font-[family-name:var(--font-display)] leading-none font-semibold tracking-[-0.04em] ${className}`;
  return href ? (
    <Link href={href} className={cls} aria-label="Exhbt home">
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
