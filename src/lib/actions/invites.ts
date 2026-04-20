"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const INVITE_TTL_DAYS = 7;

async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${proto}://${host}`;
}

function generateToken() {
  return randomBytes(24).toString("base64url");
}

type CreateInviteResult =
  | { ok: true; id: string; token: string; url: string; expiresAt: string }
  | { ok: false; error: string };

export async function createInvite(tripId: string): Promise<CreateInviteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  if (!member || member.role !== "admin") {
    return { ok: false, error: "Only admins can create invites" };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .maybeSingle<{ slug: string }>();
  if (!trip) return { ok: false, error: "Trip not found" };

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 86_400_000,
  ).toISOString();

  const service = createServiceClient();
  const { data, error } = await service
    .from("trip_invites")
    .insert({
      trip_id: tripId,
      email: null,
      invited_by: user.id,
      token,
      expires_at: expiresAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("invite insert error", error);
    return { ok: false, error: "Could not create invite" };
  }

  const origin = await getOrigin();
  const url = `${origin}/join/${token}`;

  revalidatePath(`/trips/${trip.slug}/crew`);
  return { ok: true, id: data.id, token, url, expiresAt };
}

export async function revokeInvite(inviteId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: invite } = await supabase
    .from("trip_invites")
    .select("trip_id")
    .eq("id", inviteId)
    .maybeSingle<{ trip_id: string }>();
  if (!invite) return { ok: false };

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", invite.trip_id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  if (!member || member.role !== "admin") return { ok: false };

  const { data: trip } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", invite.trip_id)
    .maybeSingle<{ slug: string }>();

  const service = createServiceClient();
  const { error } = await service
    .from("trip_invites")
    .delete()
    .eq("id", inviteId);
  if (error) {
    console.error("invite revoke error", error);
    return { ok: false };
  }

  if (trip) revalidatePath(`/trips/${trip.slug}/crew`);
  return { ok: true };
}
