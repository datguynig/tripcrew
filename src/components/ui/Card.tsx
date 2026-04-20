import type { ReactNode } from "react";

/**
 * Canonical surface: hairline border on `bg-2` with symmetric padding.
 * Sharp corners — cards stay editorial; only inputs / buttons / popovers
 * use rounded-md. See designsystem.md §4.4.
 *
 * `padding` maps to the spacing scale. Default 6 (24px). Use 5 for dense
 * cards (vote deadline panel), 7 for the AdminCard surface, 0 when you
 * need the border but own the padding yourself.
 *
 * `tone="flat"` removes the bg-2 so the card sits on canvas with border
 * only — used for inline sections that shouldn't feel elevated.
 *
 * `interactive` adds a hover border-colour change, use for Link / clickable
 * cards.
 */

type Props = {
  children: ReactNode;
  className?: string;
  padding?: 0 | 5 | 6 | 7;
  tone?: "default" | "flat";
  interactive?: boolean;
  as?: "div" | "section" | "article" | "li";
};

const PADDING: Record<0 | 5 | 6 | 7, string> = {
  0: "",
  5: "p-5",
  6: "p-6",
  7: "p-7",
};

export function Card({
  children,
  className = "",
  padding = 6,
  tone = "default",
  interactive = false,
  as: Tag = "div",
}: Props) {
  const bg = tone === "flat" ? "" : "bg-bg-2";
  const hover = interactive
    ? "hover:border-line-2 transition-colors"
    : "";
  return (
    <Tag
      className={`border border-line ${bg} ${PADDING[padding]} ${hover} ${className}`}
    >
      {children}
    </Tag>
  );
}
