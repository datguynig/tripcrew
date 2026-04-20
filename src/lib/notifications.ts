import { createServiceClient } from "@/lib/supabase/server";
import type { NotificationKind, NotificationPayload } from "@/lib/types";

type Params = {
  tripId: string | null;
  actorId: string;
  kind: NotificationKind;
  entityId?: string | null;
  payload?: NotificationPayload;
  recipients: string[];
  // When set, chat-volume kinds (currently feed_message) delete any
  // prior unread rows in the same (recipient, trip, actor, kind) tuple
  // before inserting. Net effect: one bell row per talker per trip,
  // always carrying the most recent payload.
  coalesceByActorAndTrip?: boolean;
};

/**
 * Fan out an event to the given recipients. Called from server
 * actions after a successful mutation. Runs with the service role
 * client so inserts bypass RLS — safe because call sites control
 * recipient lists, and the insert policy is locked down otherwise.
 *
 * The caller is responsible for excluding the actor from recipients
 * (nobody should be notified of their own action). We assert this
 * defensively and filter the actor out if it slips through, rather
 * than silently producing spam.
 */
export async function createNotifications(params: Params): Promise<void> {
  const recipients = params.recipients.filter((id) => id !== params.actorId);
  if (recipients.length === 0) return;

  if (recipients.length !== params.recipients.length) {
    console.warn(
      `[notifications] Filtered actor ${params.actorId} out of recipients for kind=${params.kind}`,
    );
  }

  const service = createServiceClient();

  if (params.coalesceByActorAndTrip && params.tripId) {
    const { error: delErr } = await service
      .from("notifications")
      .delete()
      .in("user_id", recipients)
      .eq("trip_id", params.tripId)
      .eq("kind", params.kind)
      .eq("actor_id", params.actorId)
      .is("read_at", null);
    if (delErr) {
      console.error("[notifications] coalesce delete failed:", delErr);
    }
  }

  const rows = recipients.map((userId) => ({
    user_id: userId,
    trip_id: params.tripId,
    kind: params.kind,
    actor_id: params.actorId,
    entity_id: params.entityId ?? null,
    payload: params.payload ?? {},
  }));

  const { error } = await service.from("notifications").insert(rows);
  if (error) {
    // A notification fan-out failure must not break the underlying
    // mutation that just succeeded. Log and move on.
    console.error("[notifications] insert failed:", error);
  }
}

/**
 * Fetch the user IDs of every member of a trip except the actor.
 * Used by most fan-out call sites as the recipient list.
 */
export async function tripMemberIdsExcept(
  tripId: string,
  actorId: string,
): Promise<string[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .returns<Array<{ user_id: string }>>();
  return (data ?? []).map((r) => r.user_id).filter((id) => id !== actorId);
}
