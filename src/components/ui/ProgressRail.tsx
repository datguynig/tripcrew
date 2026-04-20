/**
 * Canonical 2px partial-state rail. Sits under a stat / row / grid
 * value to show "N of M" progress. See designsystem.md §4.13 —
 * this is the partial-state pattern; use it anywhere a numeric value
 * has a meaningful denominator (bookings done / total, votes cast /
 * crew size, kitty paid / target, etc.).
 *
 * `value` is a fraction in [0, 1]; out-of-range values are clamped.
 * Pass `aria-label` via the `label` prop; the component announces
 * the percentage via aria-valuenow for assistive tech.
 */

type Props = {
  value: number;
  label?: string;
  className?: string;
};

export function ProgressRail({ value, label, className = "" }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`h-[2px] bg-line overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full bg-accent transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
