"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

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

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

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
    revalidatePath(`/trips/${slug}/crew`);
    revalidatePath(`/trips/${slug}/admin`);
  }
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

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

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
    revalidatePath(`/trips/${slug}/crew`);
    revalidatePath(`/trips/${slug}/admin`);
  }
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

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  if (user.id === parsed.data.userId) {
    return { error: "Use Leave trip to remove yourself." };
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
    revalidatePath(`/trips/${slug}/crew`);
    revalidatePath(`/trips/${slug}/admin`);
  }
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

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

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
