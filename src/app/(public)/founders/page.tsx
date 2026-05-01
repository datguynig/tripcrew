import type { Metadata } from "next";
import { FoundersWall } from "@/components/marketing/FoundersWall";
import { FOUNDING_CREW_LIMIT } from "@/lib/pricing/foundingCount";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Pioneers · Tripcrew",
  description:
    "The 500 Pioneers shaping Tripcrew. Price-locked for life.",
};

type FounderRow = {
  id: string;
  name: string | null;
  founding_crew_at: string;
};

export default async function FoundersPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, founding_crew_at")
    .not("founding_crew_at", "is", null)
    .order("founding_crew_at", { ascending: true })
    .returns<FounderRow[]>();

  if (error) {
    console.error("/founders: profiles query failed:", error);
  }

  const founders = (data ?? []).map((row, index) => ({
    number: index + 1,
    name: row.name,
    joinedAt: row.founding_crew_at,
  }));

  return <FoundersWall founders={founders} totalSeats={FOUNDING_CREW_LIMIT} />;
}
