import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Destinations } from "@/components/destinations/Destinations";
import type { DestinationCandidate, DestinationVote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DestinationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(slug);
  if (!user) redirect("/sign-in");
  if (!trip) notFound();

  const member = await getTripMember(trip.id, user.id);
  const isAdmin = member?.role === "admin";

  const supabase = await createClient();
  const { count: crewCount } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  const { data: candidates } = await supabase
    .from("destination_candidates")
    .select("id, trip_id, title, note, proposed_by, position, created_at")
    .eq("trip_id", trip.id)
    .order("position", { ascending: true })
    .returns<DestinationCandidate[]>();

  const candidateIds = (candidates ?? []).map((c) => c.id);
  const { data: votes } = candidateIds.length
    ? await supabase
        .from("destination_votes")
        .select("candidate_id, user_id, vote, updated_at")
        .in("candidate_id", candidateIds)
        .returns<DestinationVote[]>()
    : { data: [] as DestinationVote[] };

  const lead =
    trip.status === "locked"
      ? "Decision locked. History below."
      : "Propose candidates. Vote yes, meh, or no. Admin locks the winner.";

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader code="§ 00" title="Where to." lead={lead} />
      <Destinations
        tripId={trip.id}
        tripSlug={trip.slug}
        initialCandidates={candidates ?? []}
        initialVotes={votes ?? []}
        currentUserId={user.id}
        isAdmin={isAdmin}
        crewCount={crewCount ?? 0}
        voteDeadline={trip.vote_deadline}
        locked={trip.status === "locked"}
        lockedDestination={trip.destination}
      />
    </section>
  );
}
