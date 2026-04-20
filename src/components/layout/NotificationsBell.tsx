"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { buttonClasses } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Notification, NotificationKind } from "@/lib/types";

type Props = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllRead: () => void;
  isFeedMuted: (tripId: string) => boolean;
  onToggleFeedMute: (tripId: string) => void;
};

export function NotificationsBell({
  notifications,
  unreadCount,
  loading,
  onMarkAsRead,
  onMarkAllRead,
  isFeedMuted,
  onToggleFeedMute,
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || buttonRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const first = popoverRef.current?.querySelector<HTMLElement>(
      '[data-popover-focus="first"]',
    );
    first?.focus();
  }, [open]);

  // Handle a click on a notification row. Marks it read + navigates.
  // `flushSync` guarantees the optimistic read-state update commits
  // to the DOM BEFORE router.push starts the route transition, so the
  // item visibly flips from unread → read even for instantaneous
  // navigation. Paired with optimistic local state in
  // useNotifications, this keeps state coherent even if the server
  // action is slow or fails (revert handled in the hook).
  const handleItemClick = (n: Notification, href: string | null) => {
    if (n.read_at === null) {
      flushSync(() => {
        onMarkAsRead(n.id);
      });
    }
    if (href) {
      router.push(href);
    }
  };

  const bellLabel =
    unreadCount > 0
      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
      : "No unread notifications";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={bellLabel}
        className={buttonClasses({
          variant: "icon",
          className: open ? "!text-fg !bg-bg-2" : "",
        })}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={unreadCount > 0 ? "text-fg" : ""}
          aria-hidden
        >
          <path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16l-2-2z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      </button>

      {unreadCount > 0 && (
        <span
          key={unreadCount}
          aria-hidden
          className="section-enter pointer-events-none absolute -top-[2px] -right-[2px] min-w-[14px] h-[14px] px-[4px] rounded-full bg-accent text-bg font-mono text-[9px] tabular flex items-center justify-center leading-none"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Activity"
          className="absolute top-[calc(100%+6px)] right-0 w-[360px] bg-bg-2 border border-line rounded-md shadow-lg z-50 overflow-hidden max-[520px]:fixed max-[520px]:top-[66px] max-[520px]:right-5 max-[520px]:left-5 max-[520px]:w-auto"
        >
          <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
            <span className="label text-fg-2">Activity</span>
            {unreadCount > 0 && (
              <button
                type="button"
                data-popover-focus="first"
                onClick={onMarkAllRead}
                className="label-sm text-fg-3 hover:text-fg transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-5 grid gap-4" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton variant="line" className="w-[28px]" />
                    <Skeleton variant="line" className="flex-1 max-w-[240px]" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center label text-fg-3">
                No new activity
              </div>
            ) : (
              <ul role="none" className="grid">
                {notifications.map((n, idx) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    isFirst={idx === 0 && unreadCount === 0}
                    onClick={() => handleItemClick(n, deepLinkFor(n))}
                    muted={
                      n.kind === "feed_message" && n.trip_id
                        ? isFeedMuted(n.trip_id)
                        : false
                    }
                    onToggleMute={
                      n.kind === "feed_message" && n.trip_id
                        ? () => onToggleFeedMute(n.trip_id as string)
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  isFirst,
  onClick,
  muted,
  onToggleMute,
}: {
  notification: Notification;
  isFirst: boolean;
  onClick: () => void;
  muted: boolean;
  onToggleMute?: () => void;
}) {
  const unread = notification.read_at === null;
  const focusAttr = isFirst ? { "data-popover-focus": "first" } : {};
  const isFeedMessage = notification.kind === "feed_message";
  return (
    <li
      role="none"
      className={`relative group border-b border-line last:border-b-0 transition-opacity ${
        muted ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        {...focusAttr}
        className="w-full grid grid-cols-[auto_1fr_6px] gap-3 items-start px-5 py-3 text-left hover:bg-bg-3 transition-colors cursor-pointer"
      >
        <span className="label-xs text-fg-3 tabular min-w-[32px] pt-[3px]">
          {formatRelative(notification.created_at)}
        </span>
        <span
          className={`text-[13px] leading-[1.45] line-clamp-2 ${
            muted ? "text-fg-2" : "text-fg"
          } ${isFeedMessage ? "pr-16" : ""}`}
        >
          {describe(notification)}
        </span>
        <span aria-hidden className="w-[6px] h-[6px] mt-[7px] shrink-0">
          {unread && (
            <span className="block w-full h-full rounded-full bg-accent" />
          )}
        </span>
      </button>
      {isFeedMessage && onToggleMute && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-pressed={muted}
          aria-label={
            muted
              ? "Unmute crew chat for this trip"
              : "Mute crew chat for this trip"
          }
          className={`absolute bottom-[10px] right-5 label-xs transition-opacity cursor-pointer ${
            muted
              ? "opacity-100 text-accent"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 text-fg-3 hover:text-fg focus-visible:text-fg"
          }`}
        >
          {muted ? "MUTED" : "MUTE"}
        </button>
      )}
    </li>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "NOW";
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}D`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}W`;
  const mo = Math.floor(d / 30);
  return `${mo}MO`;
}

function deepLinkFor(n: Notification): string | null {
  const slug = n.payload?.trip_slug;
  if (!slug) return null;
  const kind = n.kind as NotificationKind;
  // A removed user no longer has access to the trip — deep-linking
  // lands them on a redirect / 404. Leave the row clickable (to mark
  // as read) but don't navigate.
  if (kind === "role_changed" && n.payload?.new_role === "removed") {
    return null;
  }
  switch (kind) {
    case "destination_locked":
    case "trip_drafted":
    case "candidate_proposed":
      return `/trips/${slug}`;
    case "crew_joined":
    case "role_changed":
      return `/trips/${slug}/crew`;
    case "expense_added":
      return `/trips/${slug}/ledger`;
    case "feed_message": {
      const postId = n.payload?.post_id ?? n.entity_id;
      return postId
        ? `/trips/${slug}/feed#post-${postId}`
        : `/trips/${slug}/feed`;
    }
    default:
      return `/trips/${slug}`;
  }
}

function describe(n: Notification): string {
  const actor = n.payload?.actor_name ?? "Someone";
  const trip = n.payload?.trip_name ?? "the trip";
  const kind = n.kind as NotificationKind;
  switch (kind) {
    case "crew_joined":
      return `${actor} joined ${trip}.`;
    case "destination_locked":
      return `${n.payload?.destination ?? "A destination"} locked for ${trip}.`;
    case "trip_drafted":
      return `AI drafted ${trip}.`;
    case "candidate_proposed":
      return `${actor} proposed ${n.payload?.candidate_title ?? "a destination"} for ${trip}.`;
    case "expense_added":
      return `${actor} added ${n.payload?.expense_description ?? "an expense"} · ${n.payload?.expense_currency ?? ""}${n.payload?.expense_amount ?? ""}.`;
    case "role_changed":
      if (n.payload?.new_role === "admin")
        return `You were promoted to admin on ${trip}.`;
      if (n.payload?.new_role === "removed")
        return `You were removed from ${trip}.`;
      return `Your role changed on ${trip}.`;
    case "feed_message": {
      const excerpt = n.payload?.excerpt ?? "";
      const repliedToMe =
        n.payload?.reply_to_post_id &&
        n.payload?.reply_to_author_id === n.user_id;
      if (repliedToMe) {
        return excerpt
          ? `${actor} replied to you: "${excerpt}"`
          : `${actor} replied to you.`;
      }
      if (n.payload?.reply_to_post_id) {
        return excerpt
          ? `${actor} replied in the crew chat: "${excerpt}"`
          : `${actor} replied in the crew chat.`;
      }
      return excerpt
        ? `${actor} in the crew chat: "${excerpt}"`
        : `${actor} posted in the crew chat.`;
    }
    default:
      return "New activity.";
  }
}
