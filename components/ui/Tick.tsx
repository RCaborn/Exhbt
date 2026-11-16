import { Check } from "lucide-react";

const SIZES = {
  xs: { box: "size-4", icon: 10 },
  sm: { box: "size-[18px]", icon: 11 },
  md: { box: "size-5", icon: 12 },
  lg: { box: "size-[22px]", icon: 13 },
} as const;

/**
 * The site's one tick: an ink check on a mint disc with an ink edge (DESIGN.md: mint always takes
 * ink). Every "done" mark uses it, so ticks look the same in checklists, steps, feature lists and the
 * trust badge. Decorative by default; give `label` when the tick itself carries the meaning.
 */
export function Tick({
  size = "md",
  label,
  className = "",
  style,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      data-tick
      style={style}
      className={`inline-flex ${s.box} shrink-0 items-center justify-center rounded-full border border-ink bg-mint text-ink ${className}`}
    >
      <Check aria-hidden size={s.icon} strokeWidth={3} />
    </span>
  );
}
