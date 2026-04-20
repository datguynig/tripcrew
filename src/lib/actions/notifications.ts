"use server";

import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Notification, TripNotificationPrefs } from "@/lib/types";

const FEED_TTL_DAYS = 30;

export async function listRecent(
  limit = 20,
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { notifications: [], unreadCount: 0 };

  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Notification[]>(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  return { notifications: data ?? [], unreadCount: count ?? 0 };
}

// Mark-read writes go through the service role because we removed
// the RLS update policy (see 20260419230000_notifications_tighten_rls.sql).
// Auth is still enforced: we verify the user with the SSR client and
// scope the update to `user_id = auth.uid()` in the query itself.

export async function markAsRead(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const service = createServiceClient();
  const { error } = await service
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const service = createServiceClient();
  const { error } = await service
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Mark every unread `feed_message` for this (user, trip) as read, and
 * opportunistically purge this user's feed_message rows whose read_at
 * is older than 30 days. Called when the user opens /feed or a new
 * message arrives while they're looking — stops the bell from lighting
 * up for chat activity they're already seeing inline. Lazy TTL keeps
 * the notifications table bounded without a cron job.
 */
export async function markFeedRead(tripId: string) {
  const parsed = z.string().uuid().safeParse(tripId);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const service = createServiceClient();

  const nowIso = new Date().toISOString();
  const { error: updErr } = await service
    .from("notifications")
    .update({ read_at: nowIso })
    .eq("user_id", user.id)
    .eq("trip_id", parsed.data)
    .eq("kind", "feed_message")
    .is("read_at", null);
  if (updErr) return { error: updErr.message };

  const ttl = new Date(
    Date.now() - FEED_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error: delErr } = await service
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "feed_message")
    .lt("read_at", ttl);
  if (delErr) {
    // Non-fatal: the mark-read already succeeded. Log and continue.
    console.error("[notifications] feed TTL cleanup failed:", delErr);
  }

  return { ok: true };
}

export async function setFeedMuted(tripId: string, muted: boolean) {
  const parsed = z.string().uuid().safeParse(tripId);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("trip_notification_prefs")
    .upsert(
      {
        trip_id: parsed.data,
        user_id: user.id,
        feed_muted: muted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,user_id" },
    );
  if (error) return { error: error.message };

  // Muting clears the existing unread backlog so the bell flips quiet
  // immediately, matching the user's intent. Unmuting has no side
  // effect — they just start receiving new events from now on.
  if (muted) {
    const service = createServiceClient();
    await service
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("trip_id", parsed.data)
      .eq("kind", "feed_message")
      .is("read_at", null);
  }

  return { ok: true };
}

export async function listFeedPrefs(): Promise<TripNotificationPrefs[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("trip_notification_prefs")
    .select("*")
    .eq("user_id", user.id)
    .returns<TripNotificationPrefs[]>();
  return data ?? [];
}
