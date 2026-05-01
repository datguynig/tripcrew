type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-[18px] px-1.5 text-[9px]",
  md: "h-[22px] px-2 text-[10px]",
  lg: "h-[28px] px-2.5 text-[11px]",
};

export function PioneerBadge({
  size = "sm",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <span
      aria-label="Pioneer"
      title="Pioneer"
      className={[
        "inline-flex items-center gap-1 font-mono uppercase tracking-[0.18em] whitespace-nowrap",
        "bg-marketing-coral text-ink",
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
    >
      <span aria-hidden="true">★</span>
      <span>Pioneer</span>
    </span>
  );
}
