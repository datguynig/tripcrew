import type { SupabaseClient } from "@supabase/supabase-js";

// Stamps the founding-crew-at and pricing-grandfathered-at columns
// in a single update. Both stamps are written together so the
// price-lock guarantee is created at the same moment the founding
// status is recorded.
export async function applyFoundingStamps(
  supabase: SupabaseClient,
  profileId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      founding_crew_at: now,
      pricing_grandfathered_at: now,
    })
    .eq("id", profileId)
    .is("founding_crew_at", null);

  if (error) {
    console.error("stripe webhook: founding stamps update failed:", error);
  }
}
