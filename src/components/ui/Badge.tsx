import type { ReactNode } from "react";

/**
 * Uppercase-mono status / label chip. Non-interactive. See designsystem.md
 * §4.7 for usage rules. Wraps in a <span> so it can sit inline next to
 * body copy; add `block` via className when you need a block.
 */

type Tone = "accent" | "ok" | "warn" | "err" | "neutral" | "muted";
type Size = "sm" | "md" | "lg";

const TONE: Record<Tone, string> = {
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  err: "text-err",
  neutral: "text-fg-2",
  muted: "text-fg-3",
};

const SIZE: Record<Size, string> = {
  sm: "text-[9px] tracking-[0.18em]",
  md: "text-[10px] tracking-[0.15em]",
  lg: "text-[11px] tracking-[0.15em]",
};

type Props = {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  className?: string;
};

export function Badge({
  tone = "muted",
  size = "md",
  children,
  className = "",
}: Props) {
  return (
    <span
      className={`font-mono uppercase ${TONE[tone]} ${SIZE[size]} ${className}`}
    >
      {children}
    </span>
  );
}
