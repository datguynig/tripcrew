"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { fullApplicationSchema } from "@/lib/validators/application";
import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

type SubmitApplicationInput = {
  email: string;
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  utm_source?: string;
  utm_campaign?: string;
  referrer?: string;
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

  const { error } = await supabase.from("applications").insert({
    email: parsed.data.email,
    trips_per_year: parsed.data.trips_per_year,
    role: parsed.data.role,
    pain: parsed.data.pain,
    budget_attitude: parsed.data.budget_attitude,
    utm_source: parsed.data.utm_source ?? null,
    utm_campaign: parsed.data.utm_campaign ?? null,
    referrer: parsed.data.referrer ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, pain: parsed.data.pain };
    }
    console.error("submitApplication insert failed", error);
    return { error: "Something went wrong. Try again in a moment." };
  }

  return { ok: true, pain: parsed.data.pain };
}

export async function getApplicationCount(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}
