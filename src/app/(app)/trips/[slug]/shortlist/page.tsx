import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ShortlistBoard } from "@/components/shortlist/ShortlistBoard";
import type { Activity, Vote } from "@/lib/types";

export const revalidate = 0;

export default async function ShortlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(slug);
  if (!user) redirect("/sign-in");
  if (!trip) notFound();

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
        lead="Vote yes, meh, or no. Ranked by consensus. Tap twice to clear."
      />
      <ShortlistBoard
        activities={activities ?? []}
        initialVotes={votes ?? []}
        currentUserId={user.id}
      />
    </section>
  );
}
