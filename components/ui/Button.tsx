import { Button as AstryxButton } from "@astryxdesign/core/Button";

/**
 * The site's one button: an Astryx Button themed as a pill (themes/exhbt/exhbtTheme.ts).
 * - primary: mint with ink text. One per screen.
 * - secondary: white with an ink edge.
 * - ink: for mint and wash bands, where mint would disappear.
 * - danger: destructive actions.
 * With `href` it renders a link (a Next.js link, through the LinkProvider in app/providers.tsx).
 *
 * `children` is what shows (text, with an icon if wanted). `label` is the accessible name and
 * is only needed when it should differ from the visible text, or when children isn't plain text.
 */
type Variant = "primary" | "secondary" | "ink" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, { size: "sm" | "md" | "lg"; className: string }> = {
  sm: { size: "sm", className: "" },
  md: { size: "md", className: "" },
  lg: { size: "lg", className: "btn-lg" },
  xl: { size: "lg", className: "btn-xl" },
};

type Props = {
  children: React.ReactNode;
  label?: string;
  variant?: Variant;
  size?: Size;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  onClick?: (e: React.MouseEvent) => void;
};

export function Button({
  children,
  label,
  variant = "secondary",
  size = "md",
  href,
  type = "button",
  disabled,
  loading,
  className = "",
  ...rest
}: Props) {
  const s = SIZE[size];
  const name = label ?? (typeof children === "string" ? children : undefined);
  if (!name) throw new Error("Button needs a label when its children aren't plain text.");
  return (
    <AstryxButton
      label={name}
      variant={variant === "danger" ? "destructive" : variant}
      size={s.size}
      href={href}
      type={href ? undefined : type}
      isDisabled={disabled}
      isLoading={loading}
      className={`${s.className} ${className}`.trim()}
      {...rest}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </AstryxButton>
  );
}
