import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "icon";
type Tone = "default" | "accent";
type Size = "sm" | "md" | "lg";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const BASE =
  `inline-flex items-center justify-center font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${FOCUS}`;

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-[22px] text-[13px]",
  lg: "h-12 px-7 text-sm",
};

const VARIANTS: Record<Variant, Record<Tone, string>> = {
  primary: {
    default: "bg-fg text-bg hover:opacity-90 active:scale-[0.98]",
    accent: "bg-accent text-bg hover:opacity-90 active:scale-[0.98]",
  },
  secondary: {
    default:
      "bg-bg-2 border border-line text-fg hover:border-line-2 hover:bg-bg-3",
    accent:
      "bg-bg-2 border border-accent/40 text-accent hover:border-accent hover:bg-accent/10",
  },
  ghost: {
    default: "bg-transparent text-fg-2 hover:text-fg hover:bg-bg-2",
    accent: "bg-transparent text-accent hover:bg-accent/10",
  },
  destructive: {
    default:
      "bg-bg-2 border border-line text-err hover:border-err hover:bg-err/10",
    accent: "bg-err text-bg hover:opacity-90",
  },
  icon: {
    default:
      "h-8 w-8 p-0 text-fg-2 hover:text-fg hover:bg-bg-2 border border-transparent",
    accent: "h-8 w-8 p-0 text-accent hover:bg-accent/10",
  },
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  tone?: Tone;
  size?: Size;
  children?: ReactNode;
};

export function buttonClasses({
  variant = "primary",
  tone = "default",
  size = "md",
  className = "",
}: {
  variant?: Variant;
  tone?: Tone;
  size?: Size;
  className?: string;
} = {}) {
  const sizing = variant === "icon" ? "" : SIZES[size];
  return `${BASE} ${sizing} ${VARIANTS[variant][tone]} ${className}`.trim();
}

export function Button({
  variant = "primary",
  tone = "default",
  size = "md",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, tone, size, className })}
      {...props}
    >
      {children}
    </button>
  );
}
