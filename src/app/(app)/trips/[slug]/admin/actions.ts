"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, getTripMember } from "@/lib/auth";
import { createNotifications } from "@/lib/notifications";
import type { NotificationPayload } from "@/lib/types";

async function fanOutRoleChange(
  tripId: string,
  actorId: string,
  targetUserId: string,
  newRole: NonNullable<NotificationPayload["new_role"]>,
) {
  const service = createServiceClient();
  const [{ data: actor }, { data: trip }] = await Promise.all([
    service
      .from("profiles")
      .select("name")
      .eq("id", actorId)
      .maybeSingle<{ name: string }>(),
    service
      .from("trips")
      .select("name, slug")
      .eq("id", tripId)
      .maybeSingle<{ name: string; slug: string }>(),
  ]);
  await createNotifications({
    tripId,
    actorId,
    kind: "role_changed",
    payload: {
      actor_name: actor?.name,
      trip_name: trip?.name,
      trip_slug: trip?.slug,
      new_role: newRole,
    },
    recipients: [targetUserId],
  });
}

async function requireAdmin(
  tripId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const member = await getTripMember(tripId, user.id);
  if (!member || member.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }
  return { ok: true, userId: user.id };
}

async function resolveTripSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .maybeSingle<{ slug: string }>();
  return data?.slug ?? null;
}

export type ActionState = { ok?: true; error?: string } | undefined;

async function countAdmins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<number> {
  const { count } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("role", "admin");
  return count ?? 0;
}

const identitySchema = z.object({
  tripId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  destination: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null)
    .nullable(),
});

const datesBudgetSchema = z
  .object({
    tripId: z.string().uuid(),
    startDate: z
      .string()
      .trim()
      .transform((v) => v || null)
      .nullable()
      .refine(
        (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "Invalid start date",
      ),
    endDate: z
      .string()
      .trim()
      .transform((v) => v || null)
      .nullable()
      .refine(
        (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "Invalid end date",
      ),
    voteDeadline: z
      .string()
      .trim()
      .transform((v) => v || null)
      .nullable(),
    targetBudgetPp: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine(
        (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1_000_000),
        "Budget must be 0–1,000,000",
      ),
    targetCrewSize: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine(
        (v) =>
          v === null || (Number.isInteger(v) && v >= 1 && v <= 100),
        "Crew size 1–100",
      ),
    currency: z
      .enum([
        "GBP",
        "USD",
        "EUR",
        "SEK",
        "NOK",
        "DKK",
        "CHF",
        "JPY",
        "AUD",
        "CAD",
      ])
      .default("GBP"),
  })
  .refine(
    (d) =>
      d.startDate === null || d.endDate === null || d.startDate <= d.endDate,
    { message: "End date must be on or after start date." },
  );

export async function updateTripDatesBudget(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = datesBudgetSchema.safeParse({
    tripId: formData.get("tripId"),
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    voteDeadline: formData.get("voteDeadline") ?? "",
    targetBudgetPp: formData.get("targetBudgetPp") ?? "",
    targetCrewSize: formData.get("targetCrewSize") ?? "",
    currency: formData.get("currency") ?? "GBP",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const supabase = await createClient();

  let voteDeadline: string | null = parsed.data.voteDeadline;
  if (voteDeadline) {
    const d = new Date(voteDeadline);
    if (Number.isNaN(d.getTime())) return { error: "Invalid vote deadline." };
    voteDeadline = d.toISOString();
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .update({
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      vote_deadline: voteDeadline,
      target_budget_pp: parsed.data.targetBudgetPp,
      target_crew_size: parsed.data.targetCrewSize,
      currency: parsed.data.currency,
    })
    .eq("id", parsed.data.tripId)
    .select("slug")
    .maybeSingle<{ slug: string }>();

  if (error) {
    console.error("update trip dates/budget", error);
    return { error: "Could not save. Admin only." };
  }
  if (!trip) return { error: "Trip not found or not permitted." };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/admin`);
  return { ok: true };
}

export async function updateTripIdentity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = identitySchema.safeParse({
    tripId: formData.get("tripId"),
    name: formData.get("name"),
    destination: formData.get("destination") ?? "",
  });
  if (!parsed.success) {
    return { error: "Name is required (max 80). Destination max 80." };
  }

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data: trip, error } = await supabase
    .from("trips")
    .update({
      name: parsed.data.name,
      destination: parsed.data.destination,
    })
    .eq("id", parsed.data.tripId)
    .select("slug")
    .maybeSingle<{ slug: string }>();

  if (error) {
    console.error("update trip identity", error);
    return { error: "Could not save. Admin only." };
  }
  if (!trip) return { error: "Trip not found or not permitted." };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/admin`);
  return { ok: true };
}

const sectionLeadsSchema = z.object({
  tripId: z.string().uuid(),
  leads: z.object({
    overview: z.string().trim().max(300),
    shortlist: z.string().trim().max(300),
    bookings: z.string().trim().max(300),
    ledger: z.string().trim().max(300),
    feed: z.string().trim().max(300),
  }),
});

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function getTripMeta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from("trips")
    .select("meta")
    .eq("id", tripId)
    .maybeSingle<{ meta: Record<string, unknown> | null }>();
  return data?.meta ?? {};
}

export async function updateSectionLeads(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sectionLeadsSchema.safeParse({
    tripId: formData.get("tripId"),
    leads: {
      overview: formData.get("overview") ?? "",
      shortlist: formData.get("shortlist") ?? "",
      bookings: formData.get("bookings") ?? "",
      ledger: formData.get("ledger") ?? "",
      feed: formData.get("feed") ?? "",
    },
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const gate = await requireAdmin(parsed.data.tripId);
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();
  const existing = await getTripMeta(supabase, parsed.data.tripId);
  const section_leads = Object.fromEntries(
    Object.entries(parsed.data.leads).filter(([, v]) => v.length > 0),
  );
  const meta = { ...existing, section_leads };

  const { data: trip, error } = await supabase
    .from("trips")
    .update({ meta })
    .eq("id", parsed.data.tripId)
    .select("slug")
    .maybeSingle<{ slug: string }>();

  if (error) {
    console.error("update section leads", error);
    return { error: "Could not save. Admin only." };
  }
  if (!trip) return { error: "Trip not found or not permitted." };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/admin`);
  revalidatePath(`/trips/${trip.slug}/shortlist`);
  revalidatePath(`/trips/${trip.slug}/bookings`);
  revalidatePath(`/trips/${trip.slug}/ledger`);
  revalidatePath(`/trips/${trip.slug}/feed`);
  return { ok: true };
}

const memberMutationSchema = z.object({
  tripId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function promoteMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberMutationSchema.safeParse({
    tripId: formData.get("tripId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  const gate = await requireAdmin(parsed.data.tripId);
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_members")
    .update({ role: "admin" })
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    console.error("promote member", error);
    return { error: "Could not promote. Admin only." };
  }

  const slug = await resolveTripSlug(supabase, parsed.data.tripId);
  if (slug) {
    revalidatePath(`/trips/${slug}`);
    revalidatePath(`/trips/${slug}/crew`);
    revalidatePath(`/trips/${slug}/admin`);
  }
  await fanOutRoleChange(
    parsed.data.tripId,
    gate.userId,
    parsed.data.userId,
    "admin",
  );
  return { ok: true };
}

export async function demoteMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberMutationSchema.safeParse({
    tripId: formData.get("tripId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  const gate = await requireAdmin(parsed.data.tripId);
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle<{ role: string }>();

  if (target?.role === "admin") {
    const admins = await countAdmins(supabase, parsed.data.tripId);
    if (admins <= 1) {
      return { error: "Can't demote the last admin. Promote someone else first." };
    }
  }

  const { error } = await supabase
    .from("trip_members")
    .update({ role: "member" })
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    console.error("demote member", error);
    return { error: "Could not demote. Admin only." };
  }

  const slug = await resolveTripSlug(supabase, parsed.data.tripId);
  if (slug) {
    revalidatePath(`/trips/${slug}`);
    revalidatePath(`/trips/${slug}/crew`);
    revalidatePath(`/trips/${slug}/admin`);
  }
  await fanOutRoleChange(
    parsed.data.tripId,
    gate.userId,
    parsed.data.userId,
    "member",
  );
  return { ok: true };
}

export async function removeMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberMutationSchema.safeParse({
    tripId: formData.get("tripId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  const gate = await requireAdmin(parsed.data.tripId);
  if (!gate.ok) return { error: gate.error };

  if (gate.userId === parsed.data.userId) {
    return { error: "Can't remove yourself." };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle<{ role: string }>();

  if (target?.role === "admin") {
    const admins = await countAdmins(supabase, parsed.data.tripId);
    if (admins <= 1) {
      return { error: "Can't remove the last admin. Promote someone else first." };
    }
  }

  const { error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    console.error("remove member", error);
    return { error: "Could not remove. Admin only." };
  }

  const slug = await resolveTripSlug(supabase, parsed.data.tripId);
  if (slug) {
    revalidatePath(`/trips/${slug}`);
    revalidatePath(`/trips/${slug}/crew`);
    revalidatePath(`/trips/${slug}/admin`);
  }
  await fanOutRoleChange(
    parsed.data.tripId,
    gate.userId,
    parsed.data.userId,
    "removed",
  );
  return { ok: true };
}

const deleteTripSchema = z.object({
  tripId: z.string().uuid(),
  confirmName: z.string().trim().min(1),
});

export async function deleteTrip(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteTripSchema.safeParse({
    tripId: formData.get("tripId"),
    confirmName: formData.get("confirmName") ?? "",
  });
  if (!parsed.success) return { error: "Type the trip name to confirm." };

  const gate = await requireAdmin(parsed.data.tripId);
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("name")
    .eq("id", parsed.data.tripId)
    .maybeSingle<{ name: string }>();

  if (!trip) return { error: "Trip not found." };
  if (trip.name.trim() !== parsed.data.confirmName.trim()) {
    return { error: "Name doesn't match." };
  }

  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", parsed.data.tripId);

  if (error) {
    console.error("delete trip", error);
    return { error: "Could not delete. Admin only." };
  }

  revalidatePath("/");
  redirect("/");
}
