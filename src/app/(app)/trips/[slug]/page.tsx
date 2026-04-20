import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { Hero } from "@/components/layout/Hero";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SpecGrid } from "@/components/overview/SpecGrid";
import { Schedule } from "@/components/overview/Schedule";
import { AIDraftCTA } from "@/components/overview/AIDraftCTA";
import { AIFeedbackCard } from "@/components/overview/AIFeedbackCard";
import { aiEnabled as aiConfigured } from "@/lib/ai";
import { placesEnabled } from "@/lib/places";
import { getRedraftAvailability } from "@/lib/actions/aiDraft";

export const dynamic = "force-dynamic";

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "Dates TBD";
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
      .toUpperCase();
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

export default async function TripOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(slug);
  if (!trip) notFound();

  if (trip.status === "planning") {
    redirect(`/trips/${trip.slug}/destinations`);
  }

  const member = user ? await getTripMember(trip.id, user.id) : null;
  const isAdmin = member?.role === "admin";
  const supabase = await createClient();
  const [{ data: bookings }, { data: expenses }, { count: crewCount }] =
    await Promise.all([
      supabase.from("bookings").select("done").eq("trip_id", trip.id),
      supabase.from("expenses").select("amount").eq("trip_id", trip.id),
      supabase
        .from("trip_members")
        .select("user_id", { count: "exact", head: true })
        .eq("trip_id", trip.id),
    ]);

  const bookingsTotal = bookings?.length ?? 0;
  const bookingsDone = bookings?.filter((b) => b.done).length ?? 0;
  const kittyTotal =
    expenses?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  const aiDrafted = trip.ai_drafted_at !== null;
  const availability =
    aiDrafted && isAdmin && user?.profile.ai_enabled && trip.destination
      ? await getRedraftAvailability(trip.id)
      : null;
  const surfaceDraftedAt = trip.meta?.surface_drafted_at ?? {};
  const aiRailBase =
    aiDrafted && isAdmin && user?.profile.ai_enabled && trip.destination
      ? {
          tripId: trip.id,
          destination: trip.destination,
          canRedraft: availability?.ok ?? false,
          blockedReason: availability?.ok ? null : availability?.reason ?? null,
        }
      : undefined;

  const versionCounts = aiRailBase
    ? await (async () => {
        const { data } = await supabase
          .from("ai_draft_versions")
          .select("surface")
          .eq("trip_id", trip.id)
          .returns<Array<{ surface: string }>>();
        const counts: Record<string, number> = {};
        for (const r of data ?? []) counts[r.surface] = (counts[r.surface] ?? 0) + 1;
        return counts;
      })()
    : {};

  const aiRailSpec = aiRailBase
    ? {
        ...aiRailBase,
        draftedAt: surfaceDraftedAt.spec_grid ?? trip.ai_drafted_at,
        versionsCount: versionCounts.spec_grid ?? 0,
      }
    : undefined;
  const aiRailSchedule = aiRailBase
    ? {
        ...aiRailBase,
        draftedAt: surfaceDraftedAt.schedule ?? trip.ai_drafted_at,
        versionsCount: versionCounts.schedule ?? 0,
      }
    : undefined;

  const heroTitle = trip.hero_title ?? trip.destination ?? trip.name;
  const heroSubtitle = trip.hero_subtitle;
  const cityLabel = trip.city_label ?? trip.destination ?? "TBD";
  const datesLabel =
    trip.dates_label ?? formatDateRange(trip.start_date, trip.end_date);
  const specCells = trip.meta?.spec_grid ?? [];
  const scheduleRows = trip.meta?.schedule ?? [];
  const overviewLead =
    trip.meta?.section_leads?.overview ??
    "Spec grid and schedule for the trip. Admin can edit in settings.";

  return (
    <>
      <Hero
        heroTitle={heroTitle}
        heroSubtitle={heroSubtitle}
        cityLabel={cityLabel}
        datesLabel={datesLabel}
        startDate={trip.start_date}
        status={trip.status}
        crewCount={crewCount ?? 0}
        targetCrew={trip.target_crew_size}
        bookingsDone={bookingsDone}
        bookingsTotal={bookingsTotal}
        kittyTotal={kittyTotal}
        targetBudgetPp={trip.target_budget_pp}
        currency={trip.currency}
        tripId={trip.id}
        isAdmin={isAdmin}
      />

      <section className="py-14 pb-24 section-enter">
        <SectionHeader code="§ 01" title="The brief." lead={overviewLead} />

        {(() => {
          const showAICTA =
            isAdmin &&
            user?.profile.ai_enabled &&
            trip.ai_drafted_at === null &&
            aiConfigured() &&
            placesEnabled() &&
            !!trip.destination;

          return (
            <>
              {showAICTA && trip.destination && (
                <AIDraftCTA
                  tripId={trip.id}
                  destination={trip.destination}
                  tripSlug={trip.slug}
                  crewCount={crewCount ?? 0}
                  currency={trip.currency ?? "GBP"}
                  targetBudgetPp={trip.target_budget_pp}
                  existingPreferences={trip.meta?.ai_preferences ?? null}
                />
              )}

              <SpecGrid
                cells={specCells}
                isAdmin={isAdmin}
                tripId={trip.id}
                tripSlug={trip.slug}
                currency={trip.currency ?? "GBP"}
                aiDrafted={aiDrafted}
                aiRail={aiRailSpec}
              />
              <Schedule
                rows={scheduleRows}
                isAdmin={isAdmin}
                tripId={trip.id}
                tripSlug={trip.slug}
                startDate={trip.start_date}
                aiDrafted={aiDrafted}
                aiRail={aiRailSchedule}
              />
            </>
          );
        })()}

        {trip.ai_drafted_at !== null && user && (
          <AIFeedbackCard
            tripId={trip.id}
            surface="all"
            canRedraft={availability?.ok ?? false}
            redraftBlockedReason={
              availability?.ok ? null : availability?.reason ?? null
            }
            destination={trip.destination}
          />
        )}
      </section>
    </>
  );
}
