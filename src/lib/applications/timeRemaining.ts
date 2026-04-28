// Compact countdown formatter for admin surfaces. Pairs with timeAgo()
// — that one looks at the past, this one looks at the future.
// Examples: "23h LEFT", "2h LEFT", "45m LEFT", "EXPIRES NOW",
// "EXPIRED" (if the deadline is in the past).

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeRemaining(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff)) return "EXPIRED";
  if (diff <= 0) return "EXPIRED";
  if (diff < 5 * MINUTE) return "EXPIRES NOW";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m LEFT`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h LEFT`;
  return `${Math.floor(diff / DAY)}d LEFT`;
}

// Used in body copy where the all-caps shouty form is wrong.
export function timeRemainingPhrase(
  iso: string,
  now: number = Date.now(),
): string {
  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff) || diff <= 0) return "any moment";
  if (diff < 5 * MINUTE) return "a moment";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.floor(diff / DAY);
  return `${d} day${d === 1 ? "" : "s"}`;
}
