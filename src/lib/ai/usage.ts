import { createServiceClient } from "@/lib/supabase/server";

export type UsageFeature =
  | "lock_and_draft_basic"
  | "lock_and_draft_enriched"
  | "price_refresh"
  | "candidate_draft_basic"
  | "curated_teaser"
  | "concierge_chat";

export interface UsageRecord {
  userId: string;
  tripId: string;
  feature: UsageFeature;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  placesCalls?: number;
  estimatedCostGBP: number;
  succeeded: boolean;
  errorMessage?: string;
  durationMs?: number;
}

export async function logAiUsage(record: UsageRecord): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("ai_usage").insert({
    user_id: record.userId,
    trip_id: record.tripId,
    operation: record.feature,
    provider: record.model === "none" ? "system" : "gemini",
    feature: record.feature,
    model: record.model,
    input_tokens: record.inputTokens,
    output_tokens: record.outputTokens,
    places_calls: record.placesCalls ?? 0,
    places_requests: record.placesCalls ?? 0,
    estimated_cost_gbp: record.estimatedCostGBP,
    succeeded: record.succeeded,
    error_message: record.errorMessage,
    duration_ms: record.durationMs,
  });

  if (error) console.error("logAiUsage failed:", error);
}

export interface TeaserUsageRecord {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostGBP: number;
  durationMs?: number;
}

// Telemetry for the curated-trip personalised teaser flow. Visitors are
// anonymous (no auth user, no trip), so user_id and trip_id are null.
export async function logTeaserAiUsage(record: TeaserUsageRecord): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("ai_usage").insert({
    user_id: null,
    trip_id: null,
    operation: "curated_teaser",
    provider: "gemini",
    feature: "curated_teaser",
    model: record.model,
    input_tokens: record.inputTokens,
    output_tokens: record.outputTokens,
    places_calls: 0,
    places_requests: 0,
    estimated_cost_gbp: record.estimatedCostGBP,
    succeeded: true,
    duration_ms: record.durationMs,
  });

  if (error) console.error("logTeaserAiUsage failed:", error);
}
