"use client";

type Props = {
  liked: boolean;
  count: number;
  onToggle: () => void;
  /** Use `label-xs` text instead of `label-sm`. */
  compact?: boolean;
  className?: string;
};

export function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function LikeToggle({
  liked,
  count,
  onToggle,
  compact = false,
  className = "",
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`flex items-center gap-[4px] transition-colors cursor-pointer ${
        liked ? "text-accent" : "text-fg-3 hover:text-fg"
      } ${compact ? "label-xs" : "label-sm"} ${className}`}
    >
      <HeartIcon filled={liked} />
      <span className="tabular">{count}</span>
    </button>
  );
}
