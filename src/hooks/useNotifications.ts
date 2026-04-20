"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listRecent,
  markAllRead as markAllReadAction,
  markAsRead as markAsReadAction,
} from "@/lib/actions/notifications";
import type { Notification } from "@/lib/types";

/**
 * Fetches the current user's last 20 notifications + unread count,
 * subscribes to realtime inserts/updates/deletes, and exposes
 * optimistic mark-read mutators.
 *
 * Optimism contract: `onMarkAsRead` and `onMarkAllRead` flip local
 * state synchronously (the UI updates on the next render tick, no
 * waiting on the server). The server action fires in the background;
 * if it fails, we revert the optimistic change and surface nothing
 * to the user (these are non-critical). Realtime will reconcile
 * eventually regardless.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Ref mirror of notifications so the realtime handler can read
  // current state without capturing stale closures or nesting
  // setState calls (React's updater callbacks must be pure).
  const notificationsRef = useRef<Notification[]>([]);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Initial fetch.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { notifications: ns, unreadCount: uc } = await listRecent(20);
      if (cancelled) return;
      setNotifications(ns);
      setUnreadCount(uc);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime subscription — filtered to own user_id at the Postgres
  // layer so we don't receive other users' rows.
  //
  // Channel name includes a per-instance random suffix because
  // useNotifications is mounted in multiple components (Nav,
  // TripSwitcher, NotificationsBellMount). Supabase's client caches
  // channels by name, so a shared name would reuse an already-
  // subscribed channel and throw when the second instance calls
  // `.on()` after `.subscribe()`.
  const instanceIdRef = useRef<string>("");
  if (instanceIdRef.current === "") {
    instanceIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`rt:notifications:${user.id}:${instanceIdRef.current}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Notification;
              if (notificationsRef.current.some((n) => n.id === row.id)) return;
              setNotifications((prev) => [row, ...prev].slice(0, 20));
              if (row.read_at === null) {
                setUnreadCount((c) => c + 1);
              }
              return;
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Notification;
              const existing = notificationsRef.current.find(
                (n) => n.id === row.id,
              );
              setNotifications((prev) =>
                prev.map((n) => (n.id === row.id ? row : n)),
              );
              if (!existing) return;
              const wasUnread = existing.read_at === null;
              const isUnread = row.read_at === null;
              if (wasUnread === isUnread) return;
              setUnreadCount((c) =>
                isUnread ? c + 1 : Math.max(0, c - 1),
              );
              return;
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              const existing = notificationsRef.current.find(
                (n) => n.id === row.id,
              );
              setNotifications((prev) => prev.filter((n) => n.id !== row.id));
              if (existing && existing.read_at === null) {
                setUnreadCount((c) => Math.max(0, c - 1));
              }
            }
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const onMarkAsRead = (id: string) => {
    const existing = notificationsRef.current.find((n) => n.id === id);
    if (!existing || existing.read_at !== null) return;
    const optimisticStamp = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: optimisticStamp } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    void markAsReadAction(id).then((res) => {
      if (!res?.error) return;
      // Only revert if nothing else has landed for this row since our
      // optimistic write. Otherwise realtime is authoritative and we
      // must not clobber it.
      const current = notificationsRef.current.find((n) => n.id === id);
      if (current?.read_at === optimisticStamp) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)),
        );
        setUnreadCount((c) => c + 1);
      }
    });
  };

  const onMarkAllRead = () => {
    const snapshot = notificationsRef.current;
    const previousUnread = unreadCount;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n)),
    );
    setUnreadCount(0);
    void markAllReadAction().then((res) => {
      if (res?.error) {
        setNotifications(snapshot);
        setUnreadCount(previousUnread);
      }
    });
  };

  // Per-trip unread count for feed_message kind. Coalescing in the
  // server action keeps this at ~1 row per actor-trip, so the last-20
  // window nearly always catches the full picture.
  const feedUnreadByTrip = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notifications) {
      if (n.kind !== "feed_message") continue;
      if (n.read_at !== null) continue;
      if (!n.trip_id) continue;
      m[n.trip_id] = (m[n.trip_id] ?? 0) + 1;
    }
    return m;
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    onMarkAsRead,
    onMarkAllRead,
    feedUnreadByTrip,
  };
}
