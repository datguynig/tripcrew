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
        .channel(`rt:trip_prefs:${user.id}:${instanceIdRef.current}`)
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
