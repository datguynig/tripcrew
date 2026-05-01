import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { hasProAccessForTrip } from "@/lib/plan";
import { forwardGeocode, mapboxEnabled } from "@/lib/mapbox";
import { enrichPlace } from "@/lib/placeEnrichment";
import { placesEnabled } from "@/lib/places";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Destinations } from "@/components/destinations/Destinations";
import type { DestinationCandidate, DestinationVote } from "@/lib/types";

export const dynamic = "force-dynamic";
// Lock dialog → lockAndStartDraft kicks off generateLockAndDraft via
// after(); both run on this page's function invocation, so the
// page-level maxDuration governs them.
export const maxDuration = 90;

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
    .select(
      "id, trip_id, title, note, proposed_by, position, created_at, mapbox_id, longitude, latitude, country, photo_url, photo_attribution, basic_draft, basic_draft_generated_at",
    )
    .eq("trip_id", trip.id)
    .order("position", { ascending: true })
    .returns<DestinationCandidate[]>();

  const hasPro = isAdmin ? await hasProAccessForTrip(user.id, trip.id) : false;

  // Self-healing backfill — runs after the response so render isn't blocked.
  // Realtime UPDATEs deliver the result to clients. Two independent stages so
  // a partial failure on one stage doesn't strand the row forever:
  //
  //   Stage 1 (coords): rows persisted before the Mapbox token reached prod
  //     have null coords. Forward-geocode the title to fill them.
  //   Stage 2 (photo):  rows with coords but no photo (because earlier
  //     enrichment timed out, errored, or never ran). Independent from
  //     Stage 1 — retries on every page load until photo lands.
  const coordless = (candidates ?? [])
    .filter((c) => c.latitude === null && c.longitude === null)
    .map((c) => ({ id: c.id, title: c.title }));

  const photoless = (candidates ?? [])
    .filter(
      (c) =>
        c.latitude !== null && c.longitude !== null && c.photo_url === null,
    )
    .map((c) => ({
      id: c.id,
      title: c.title,
      latitude: c.latitude as number,
      longitude: c.longitude as number,
    }));

  if (coordless.length > 0 && mapboxEnabled()) {
    after(async () => {
      const service = createServiceClient();
      await Promise.allSettled(
        coordless.map(async ({ id, title }) => {
          try {
            const place = await forwardGeocode(title);
            if (!place) return;
            await service
              .from("destination_candidates")
              .update({
                mapbox_id: place.mapboxId,
                longitude: place.longitude,
                latitude: place.latitude,
                country: place.country,
              })
              .eq("id", id);
          } catch (err) {
            console.error(`backfill coords failed for ${id} (${title}):`, err);
          }
        }),
      );
    });
  }

  if (photoless.length > 0 && placesEnabled()) {
    after(async () => {
      const service = createServiceClient();
      await Promise.allSettled(
        photoless.map(async ({ id, title, latitude, longitude }) => {
          try {
            const enrichment = await enrichPlace({
              name: title,
              latitude,
              longitude,
              radiusMeters: 50_000,
            });
            if (!enrichment.photoUrl) {
              console.warn(
                `backfill photo: enrichPlace returned null for ${id} (${title})`,
              );
              return;
            }
            await service
              .from("destination_candidates")
              .update({
                photo_url: enrichment.photoUrl,
                photo_attribution: enrichment.photoAttribution,
              })
              .eq("id", id);
          } catch (err) {
            console.error(`backfill photo failed for ${id} (${title}):`, err);
          }
        }),
      );
    });
  }

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
        hasPro={hasPro}
        crewCount={crewCount ?? 0}
        voteDeadline={trip.vote_deadline}
        locked={trip.status === "locked"}
        lockedDestination={trip.destination}
        aiDrafted={trip.ai_drafted_at !== null}
        tripCurrency={trip.currency ?? "GBP"}
        tripBudgetPp={trip.target_budget_pp}
        tripStartDate={trip.start_date}
        tripEndDate={trip.end_date}
        tripTargetCrewSize={trip.target_crew_size}
        tripPreferences={trip.meta?.ai_preferences ?? null}
      />
    </section>
  );
}
