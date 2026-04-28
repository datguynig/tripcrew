import { createServiceClient } from "@/lib/supabase/server";
import type { DraftLead } from "@/lib/types";

/**
 * Look up (or create) an auth user for `email`, then upsert their
 * `profiles` row with the Stripe customer id and active subscription
 * status. Used by the founding-checkout webhook to provision a new
 * customer atomically with their Stripe completion event.
 */
export async function provisionProfileForCheckout(params: {
  email: string;
  customerId: string;
  isFoundingMember: boolean;
}): Promise<{ id: string; isNew: boolean }> {
  const supabase = createServiceClient();
  const lower = params.email.toLowerCase();

  // 1. Find an existing auth user by email. listUsers paginates at 1000;
  // we walk pages until we hit the email or run out. In practice the user
  // either exists in page 1 or doesn't exist at all, but the loop keeps
  // us correct as the user base grows.
  let userId: string | null = null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error(`auth.admin.listUsers failed: ${error.message}`);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === lower);
    if (match) {
      userId = match.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  let isNew = false;
  if (!userId) {
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email: params.email,
        email_confirm: true,
      });
    if (createErr || !created.user) {
      throw new Error(`createUser failed: ${createErr?.message}`);
    }
    userId = created.user.id;
    isNew = true;
  }

  // 2. Upsert the profile. `name` is required by the schema check
  // constraint (length 1..60) and we don't want to clobber an existing
  // user's display name on a stripe-event replay — so we branch on
  // whether the row already exists.
  //
  // Founding-cohort membership is stamped via `founding_crew_at`, NOT
  // `is_founder`. The latter is the platform-admin gate for
  // /admin/applications/* and stays reserved for the platform founder
  // account (see 20260429000100_applications_admin_columns.sql + the
  // founding_crew_flag migration). Mixing the two would grant every
  // paying founding-tier customer admin access.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, founding_crew_at")
    .eq("id", userId)
    .maybeSingle<{ id: string; founding_crew_at: string | null }>();

  if (existingProfile) {
    const updatePayload: Record<string, unknown> = {
      stripe_customer_id: params.customerId,
      stripe_subscription_status: "active",
    };
    if (params.isFoundingMember && !existingProfile.founding_crew_at) {
      updatePayload.founding_crew_at = new Date().toISOString();
    }
    const { error: updateErr } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);
    if (updateErr) {
      throw new Error(`profiles update failed: ${updateErr.message}`);
    }
  } else {
    const placeholderName = derivePlaceholderName(params.email);
    const insertPayload: Record<string, unknown> = {
      id: userId,
      name: placeholderName,
      stripe_customer_id: params.customerId,
      stripe_subscription_status: "active",
    };
    if (params.isFoundingMember) {
      insertPayload.founding_crew_at = new Date().toISOString();
    }
    const { error: insertErr } = await supabase
      .from("profiles")
      .insert(insertPayload);
    if (insertErr) {
      throw new Error(`profiles insert failed: ${insertErr.message}`);
    }
  }

  return { id: userId, isNew };
}

/**
 * Create the founder's first trip pre-seeded from their draft inputs.
 * Idempotent: if a trip already exists for this user with a matching
 * `meta->>draft_lead_id`, it's returned untouched. Otherwise a new
 * trip + admin trip_members row is created in `planning` status so the
 * user lands inside the destinations flow on their first sign-in.
 */
export async function createFirstTripFromDraft(
  userId: string,
  draft: DraftLead,
): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("trips")
    .select("id")
    .eq("created_by", userId)
    .eq("meta->>draft_lead_id", draft.id)
    .maybeSingle<{ id: string }>();
  if (existing) return existing;

  const slug = `${draft.slug}-${draft.id.slice(0, 6)}`;
  const cityLabel =
    draft.slug.charAt(0).toUpperCase() + draft.slug.slice(1).replace(/-/g, " ");

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      slug,
      name: `${cityLabel} crew`,
      city_label: cityLabel,
      status: "planning",
      currency: "GBP",
      target_crew_size: parseCrewSize(draft.inputs.crew),
      target_budget_pp: parseBudget(draft.inputs.budget),
      created_by: userId,
      meta: {
        draft_lead_id: draft.id,
        ai_preferences: {
          origin: null,
          crew_size: parseCrewSize(draft.inputs.crew),
          budget_tier: "mid",
          budget_custom_pp: parseBudget(draft.inputs.budget),
          vibes: [],
        },
        // The draft origin is a raw IATA string (e.g. "LHR") — keep it
        // alongside the AI preferences so the UI can pre-fill the picker
        // when the user opens Lock & Draft. The structured AiOriginAirport
        // shape gets resolved when the user confirms in-app.
        draft_origin_iata: draft.inputs.origin,
        draft_when: draft.inputs.when,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !trip) {
    throw new Error(`createFirstTripFromDraft insert failed: ${error?.message}`);
  }

  const { error: memberErr } = await supabase.from("trip_members").insert({
    trip_id: trip.id,
    user_id: userId,
    role: "admin",
    invited_by: userId,
  });
  if (memberErr) {
    throw new Error(
      `createFirstTripFromDraft trip_members insert failed: ${memberErr.message}`,
    );
  }

  return trip;
}

/**
 * Trigger Supabase to email the user a magic-link they can click to sign
 * in. The redirect lands on `/callback`, which exchanges the OTP for a
 * session and forwards to `/profile` for first-login name capture.
 *
 * Errors are logged but not re-thrown — the webhook should still ack the
 * Stripe event even if email delivery hiccups, otherwise Stripe retries
 * and we double-provision.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const supabase = createServiceClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tripcrew.app";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/callback?next=${encodeURIComponent(
        "/profile?from=checkout",
      )}`,
    },
  });
  if (error) {
    console.error("sendMagicLink failed", { email, error: error.message });
  }
}

function parseCrewSize(crew: DraftLead["inputs"]["crew"]): number {
  switch (crew) {
    case "2":
      return 2;
    case "3-4":
      return 4;
    case "5-6":
      return 6;
    case "7+":
      return 8;
    default:
      return 4;
  }
}

function parseBudget(budget: DraftLead["inputs"]["budget"]): number {
  switch (budget) {
    case "500":
      return 500;
    case "1000":
      return 1000;
    case "1500":
      return 1500;
    case "2000+":
      return 2500;
    default:
      return 1000;
  }
}

function derivePlaceholderName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const raw = local.split(/[._-]/).find(Boolean) ?? "";
  if (!raw) return "Founder";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
