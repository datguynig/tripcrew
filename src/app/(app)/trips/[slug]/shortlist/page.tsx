import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ShortlistBoard } from "@/components/shortlist/ShortlistBoard";
import type { Activity, Vote } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  const { data: activities } = await supabase
    .from("activities")
    .select("id, trip_id, title, meta, category, position, created_at")
    .eq("trip_id", trip.id)
    .order("position", { ascending: true })
    .returns<Activity[]>();

  const activityIds = (activities ?? []).map((a) => a.id);
  const { data: votes } = activityIds.length
    ? await supabase
        .from("votes")
        .select("activity_id, user_id, vote, updated_at")
        .in("activity_id", activityIds)
        .returns<Vote[]>()
    : { data: [] as Vote[] };

  const lead =
    trip.meta?.section_leads?.shortlist ??
    "Vote yes, meh, or no. Ranked by consensus. Tap twice to clear.";

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader code="§ 03" title="Shortlist." lead={lead} />
      <ShortlistBoard
        activities={activities ?? []}
        initialVotes={votes ?? []}
        currentUserId={user.id}
      />
    </section>
  );
}
