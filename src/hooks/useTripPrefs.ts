"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listFeedPrefs,
  setFeedMuted as setFeedMutedAction,
} from "@/lib/actions/notifications";
import type { TripNotificationPrefs } from "@/lib/types";

/**
 * Per-user notification preferences, scoped to trips. Hydrates from
 * the server on mount, subscribes to realtime updates so a mute flip
 * in one tab propagates to others, and exposes an optimistic mute
 * toggle.
 */
export function useTripPrefs() {
  const [prefs, setPrefs] = useState<TripNotificationPrefs[]>([]);
  const prefsRef = useRef<TripNotificationPrefs[]>([]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await listFeedPrefs();
      if (cancelled) return;
      setPrefs(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    // Channel ID is regenerated per-effect-run so StrictMode's
    // mount/unmount/mount cycle never collides on Supabase's client-side
    // channel cache. Reusing a channel after `subscribe()` throws
    // "cannot add callbacks after subscribe". Mirrors useNotifications.
    const channelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`rt:trip_prefs:${user.id}:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "trip_notification_prefs",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setPrefs((prev) => {
              if (
                payload.eventType === "INSERT" ||
                payload.eventType === "UPDATE"
              ) {
                const row = payload.new as TripNotificationPrefs;
                const idx = prev.findIndex(
                  (p) => p.trip_id === row.trip_id,
                );
                if (idx >= 0) {
                  const copy = prev.slice();
                  copy[idx] = row;
                  return copy;
                }
                return [...prev, row];
              }
              if (payload.eventType === "DELETE") {
                const old = payload.old as Partial<TripNotificationPrefs>;
                return prev.filter((p) => p.trip_id !== old.trip_id);
              }
              return prev;
            });
          },
        )
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          void listFeedPrefs().then((data) => {
            setPrefs(data);
          });
        });
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const isFeedMuted = useCallback(
    (tripId: string) => {
      return prefsRef.current.some(
        (p) => p.trip_id === tripId && p.feed_muted,
      );
    },
    [],
  );

  const setMuted = useCallback(
    (tripId: string, muted: boolean) => {
      const now = new Date().toISOString();
      const snapshot = prefsRef.current;
      setPrefs((prev) => {
        const idx = prev.findIndex((p) => p.trip_id === tripId);
        const next: TripNotificationPrefs = {
          trip_id: tripId,
          user_id: prev[idx]?.user_id ?? "",
          feed_muted: muted,
          updated_at: now,
        };
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = { ...prev[idx], ...next };
          return copy;
        }
        return [...prev, next];
      });
      void setFeedMutedAction(tripId, muted).then((res) => {
        if (res?.error) {
          // Revert on failure.
          setPrefs(snapshot);
        }
      });
    },
    [],
  );

  return { prefs, isFeedMuted, setMuted };
}
