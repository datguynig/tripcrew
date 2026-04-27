// Compact relative-time formatter for admin surfaces. "just now" / "Nm ago"
// / "Nh ago" / "Nd ago" / "Nmo ago" / "Ny ago". Used by ApplicationRow
// and ApplicationDetail so a row reading "45d ago" and the detail view
// don't disagree on the same timestamp.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return "just now";
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < MONTH) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < YEAR) return `${Math.floor(diff / MONTH)}mo ago`;
  return `${Math.floor(diff / YEAR)}y ago`;
}
