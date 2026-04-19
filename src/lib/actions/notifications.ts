"use server";

import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";

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
