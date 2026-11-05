/**
 * The page's single green accent: one loose, hand-drawn swirl that draws itself once.
 * Decorative only. Under reduced motion it renders fully drawn.
 */
export function Swirl({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 260"
      fill="none"
      className={`swirl-draw pointer-events-none ${className}`}
    >
      <path
        pathLength={1}
        d="M18 196 C 64 98, 164 34, 248 74 C 322 110, 304 204, 228 198 C 162 192, 176 116, 252 102 C 316 90, 356 118, 384 52"
        stroke="var(--color-green)"
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
