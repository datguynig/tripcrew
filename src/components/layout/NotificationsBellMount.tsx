"use client";

import { NotificationsBell } from "./NotificationsBell";
import { useNotifications } from "@/hooks/useNotifications";
import { useTripPrefs } from "@/hooks/useTripPrefs";

export function NotificationsBellMount() {
  const {
    notifications,
    unreadCount,
    loading,
    onMarkAsRead,
    onMarkAllRead,
  } = useNotifications();
  const { isFeedMuted, setMuted } = useTripPrefs();
  return (
    <NotificationsBell
      notifications={notifications}
      unreadCount={unreadCount}
      loading={loading}
      onMarkAsRead={onMarkAsRead}
      onMarkAllRead={onMarkAllRead}
      isFeedMuted={isFeedMuted}
      onToggleFeedMute={(tripId) => setMuted(tripId, !isFeedMuted(tripId))}
    />
  );
}
