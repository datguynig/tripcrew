/**
 * Editorial loading primitive. Dim block with a slow opacity pulse —
 * sketches the shape of content while it fetches. Wrap the containing
 * region in `role="status" aria-label="Loading"` so assistive tech
 * announces the wait without reading each block individually.
 *
 * Callers size via className. `variant="line"` gives a thin 14px
 * text-row proxy (no border, fill only); default `variant="block"` is
 * a hairline-bordered rectangle suitable for cards and images.
 *
 * For inline micro-loading (a single row inside a popover, a field
 * spinner, etc.), prefer the pulsing-dot + mono-label idiom from
 * designsystem.md §4.13 — skeletons feel heavy at that scale.
 */

type Props = {
  className?: string;
  variant?: "block" | "line";
};

export function Skeleton({ className = "", variant = "block" }: Props) {
  const base =
    variant === "line"
      ? "h-[14px] bg-bg-3 animate-skeleton"
      : "bg-bg-3 border border-line animate-skeleton";
  return <div className={`${base} ${className}`} aria-hidden="true" />;
}
