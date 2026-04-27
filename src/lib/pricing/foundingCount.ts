import { createServiceClient } from "@/lib/supabase/server";

export const FOUNDING_CREW_LIMIT = 500;

export async function getFoundingCrewRemaining(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("founding_crew_at", "is", null);
  const taken = count ?? 0;
  return Math.max(0, FOUNDING_CREW_LIMIT - taken);
}
