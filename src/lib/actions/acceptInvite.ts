"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  createNotifications,
  tripMemberIdsExcept,
} from "@/lib/notifications";

type AcceptResult =
  | { kind: "ok"; slug: string }
  | { kind: "already_member"; slug: string }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "not_signed_in"; tripName: string; token: string };

export async function lookupInvite(token: string): Promise<
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "ok"; tripId: string; tripName: string; tripSlug: string }
> {
  const service = createServiceClient();
  const { data: invite } = await service
    .from("trip_invites")
    .select("id, trip_id, expires_at")
    .eq("token", token)
    .maybeSingle<{ id: string; trip_id: string; expires_at: string | null }>();
  if (!invite) return { kind: "invalid" };
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { kind: "expired" };
  }

  const { data: trip } = await service
    .from("trips")
    .select("id, name, slug")
    .eq("id", invite.trip_id)
    .maybeSingle<{ id: string; name: string; slug: string }>();
  if (!trip) return { kind: "invalid" };

  return {
    kind: "ok",
    tripId: trip.id,
    tripName: trip.name,
    tripSlug: trip.slug,
  };
}

export async function acceptInvite(token: string): Promise<AcceptResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lookup = await lookupInvite(token);
  if (lookup.kind !== "ok") return lookup;

  if (!user) {
    return {
      kind: "not_signed_in",
      tripName: lookup.tripName,
      token,
    };
  }

  const service = createServiceClient();

  const { data: existing } = await service
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", lookup.tripId)
    .eq("user_id", user.id)
    .maybeSingle<{ user_id: string }>();

  if (existing) {
    return { kind: "already_member", slug: lookup.tripSlug };
  }

  const { data: invited } = await service
    .from("trip_invites")
    .select("invited_by")
    .eq("token", token)
    .maybeSingle<{ invited_by: string | null }>();

  const { error: joinErr } = await service.from("trip_members").insert({
    trip_id: lookup.tripId,
    user_id: user.id,
    role: "member",
    invited_by: invited?.invited_by ?? null,
  });
  if (joinErr) {
    console.error("accept invite: trip_members insert", joinErr);
    return { kind: "invalid" };
  }

  await service
    .from("trip_invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq("token", token)
    .is("accepted_at", null);

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${lookup.tripSlug}`);
  revalidatePath(`/trips/${lookup.tripSlug}/crew`);
  revalidatePath(`/trips/${lookup.tripSlug}/admin`);

  const [{ data: actor }, recipients] = await Promise.all([
    service
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle<{ name: string }>(),
    tripMemberIdsExcept(lookup.tripId, user.id),
  ]);
  await createNotifications({
    tripId: lookup.tripId,
    actorId: user.id,
    kind: "crew_joined",
    payload: {
      actor_name: actor?.name,
      trip_name: lookup.tripName,
      trip_slug: lookup.tripSlug,
    },
    recipients,
  });

  return { kind: "ok", slug: lookup.tripSlug };
}

export async function acceptAndRedirect(token: string): Promise<never> {
  const res = await acceptInvite(token);
  if (res.kind === "ok" || res.kind === "already_member") {
    redirect(`/trips/${res.slug}`);
  }
  redirect(`/join/${token}`);
}
