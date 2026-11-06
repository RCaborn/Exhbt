import Link from "next/link";

/**
 * The exhbt mark: an exhibit frame, broken at the lower right by its label.
 * The frame takes `currentColor` (navy on light, white on navy); the label is
 * always light blue with a navy edge. Rules in docs/brand.md.
 */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 ${className}`}
      focusable="false"
    >
      <path
        d="M16.5 28.5H7.5a4 4 0 0 1-4-4v-17a4 4 0 0 1 4-4h17a4 4 0 0 1 4 4V15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="19.5" y="19.5" width="10.5" height="10.5" rx="2" fill="var(--color-blue)" stroke="var(--color-ink)" strokeWidth="2.5" />
    </svg>
  );
}

const SIZES = {
  sm: { mark: 18, text: "text-[1.15rem]", gap: "gap-1.5" },
  md: { mark: 24, text: "text-[1.6rem]", gap: "gap-2" },
  lg: { mark: 34, text: "text-[2.3rem]", gap: "gap-2.5" },
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
  const cls = `inline-flex items-center ${s.gap} ${s.text} leading-none font-extrabold tracking-[-0.045em] ${className}`;
  return href ? (
    <Link href={href} className={cls} aria-label="Exhbt home">
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
