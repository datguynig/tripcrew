import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ShortlistBoard } from "@/components/shortlist/ShortlistBoard";
import { SECTION_LEADS } from "@/constants/trip";
import type { Activity, Vote } from "@/lib/types";

export const revalidate = 0;

export default async function ShortlistPage() {
  const user = await getCurrentUser();
  const trip = await getTrip();
  if (!user) redirect("/sign-in");
  if (!trip) throw new Error("Trip not found");

  const supabase = await createClient();
  const [{ data: activities }, { data: votes }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, trip_id, title, meta, category, position, created_at")
      .eq("trip_id", trip.id)
      .order("position", { ascending: true })
      .returns<Activity[]>(),
    supabase
      .from("votes")
      .select("activity_id, user_id, vote, updated_at")
      .returns<Vote[]>(),
  ]);

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 03"
        title="Shortlist."
        lead={SECTION_LEADS.shortlist}
      />
      <ShortlistBoard
        activities={activities ?? []}
        initialVotes={votes ?? []}
        currentUserId={user.id}
      />
    </section>
  );
}
