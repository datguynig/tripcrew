"use client";

import { NotificationsBell } from "./NotificationsBell";
import { useNotifications } from "@/hooks/useNotifications";
import { useTripPrefs } from "@/hooks/useTripPrefs";

export function NotificationsBellMount() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    onMarkAsRead,
    onMarkAllRead,
    onRetry,
  } = useNotifications();
  const { isFeedMuted, setMuted } = useTripPrefs();
  return (
    <NotificationsBell
      notifications={notifications}
      unreadCount={unreadCount}
      loading={loading}
      error={error}
      onMarkAsRead={onMarkAsRead}
      onMarkAllRead={onMarkAllRead}
      onRetry={onRetry}
      isFeedMuted={isFeedMuted}
      onToggleFeedMute={(tripId) => setMuted(tripId, !isFeedMuted(tripId))}
    />
  );
}
