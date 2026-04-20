import type { Post } from "@/lib/types";

const GROUP_WINDOW_MS = 120_000;
const DAY_MS = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    .toUpperCase();
}

export function needsDaySeparator(curr: Post, prev: Post | null): boolean {
  if (!prev) return true;
  return (
    startOfDay(new Date(curr.created_at)) !==
    startOfDay(new Date(prev.created_at))
  );
}

export function isGrouped(curr: Post, prev: Post | null): boolean {
  if (!prev) return false;
  if (prev.author_id !== curr.author_id) return false;
  if (needsDaySeparator(curr, prev)) return false;
  const diff =
    new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff < GROUP_WINDOW_MS;
}

export function initials(name: string | undefined): string {
  if (!name) return "··";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (parts[0] ?? "").slice(0, 2).toUpperCase();
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
