"use server";

import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fullApplicationSchema } from "@/lib/validators/application";
import { computeProvisionalDecision } from "@/lib/applications/heuristic";
import {
  buildApplicationReceivedEmail,
  sendApplicationReceived,
} from "@/lib/email/teaserEmails";
import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

type SubmitApplicationInput = {
  email: string;
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  utm_source?: string;
  utm_campaign?: string;
  referrer?: string;
  draft_lead_id?: string | null;
};

type SubmitResult =
  | { ok: true; pain: ApplicationPain }
  | { ok?: false; error: string };

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<SubmitResult> {
  const parsed = fullApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Some answers were missing or invalid." };
  }

  const supabase = createServiceClient();

  const provisional = computeProvisionalDecision({
    trips_per_year: parsed.data.trips_per_year,
    role: parsed.data.role,
    pain: parsed.data.pain,
    budget_attitude: parsed.data.budget_attitude,
    email: parsed.data.email,
  });

  const autoDecisionAt = new Date(Date.now() + REVIEW_WINDOW_MS).toISOString();

  // Resolve the originating draft's slug so the application-received email
  // can deep-link to that trip's founding-checkout. If the application
  // came in cold (no draft), draftSlug stays null and the email omits the
  // skip-the-queue link.
  let draftSlug: string | null = null;
  if (parsed.data.draft_lead_id) {
    const { data: draft } = await supabase
      .from("draft_leads")
      .select("slug")
      .eq("id", parsed.data.draft_lead_id)
      .maybeSingle<{ slug: string }>();
    draftSlug = draft?.slug ?? null;
  }

  const { error } = await supabase.from("applications").insert({
    email: parsed.data.email,
    trips_per_year: parsed.data.trips_per_year,
    role: parsed.data.role,
    pain: parsed.data.pain,
    budget_attitude: parsed.data.budget_attitude,
    utm_source: parsed.data.utm_source ?? null,
    utm_campaign: parsed.data.utm_campaign ?? null,
    referrer: parsed.data.referrer ?? null,
    draft_lead_id: parsed.data.draft_lead_id ?? null,
    provisional_decision: provisional,
    auto_decision_at: autoDecisionAt,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, pain: parsed.data.pain };
    }
    console.error("submitApplication insert failed", error);
    return { error: "Something went wrong. Try again in a moment." };
  }

  // Fire-and-forget the application-received email via after() so the
  // form submission returns fast and the email is dispatched after the
  // response is on the wire (matches the pattern in submitTeaserForm).
  const recipientEmail = parsed.data.email;
  after(async () => {
    try {
      await sendApplicationReceived(
        buildApplicationReceivedEmail({
          email: recipientEmail,
          slug: draftSlug,
        }),
      );
    } catch (err) {
      console.error("submitApplication: received-email send failed:", err);
    }
  });

  return { ok: true, pain: parsed.data.pain };
}

export async function getApplicationCount(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}
