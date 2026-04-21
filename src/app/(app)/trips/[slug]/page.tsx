import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { Hero } from "@/components/layout/Hero";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SpecGrid } from "@/components/overview/SpecGrid";
import { Schedule } from "@/components/overview/Schedule";
import { AIDraftCTA } from "@/components/overview/AIDraftCTA";
import { AIFeedbackCard } from "@/components/overview/AIFeedbackCard";
import { PolaroidStack } from "@/components/overview/PolaroidStack";
import type { PolaroidSlot } from "@/components/overview/PolaroidStack";
import { aiEnabled as aiConfigured } from "@/lib/ai";
import { placesEnabled } from "@/lib/places";
import { getRedraftAvailability } from "@/lib/actions/aiDraft";
import type { PolaroidOverride } from "@/lib/types";

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

function relativeTimeLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}W AGO`;
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    .toUpperCase();
}

function composePolaroidSlots({
  destinationTitle,
  heroImageUrl,
  heroImageAttribution,
  activities,
  recentPhotos,
  authorNameById,
  overrides,
}: {
  destinationTitle: string | null;
  heroImageUrl: string | null;
  heroImageAttribution: string | null;
  activities: Array<{
    id: string;
    title: string;
    photo_url: string | null;
    photo_attribution: string | null;
  }>;
  recentPhotos: Array<{
    id: string;
    image_url: string | null;
    caption: string | null;
    author_id: string;
    created_at: string;
  }>;
  authorNameById: Map<string, string>;
  overrides: PolaroidOverride[];
}): PolaroidSlot[] {
  const defaults: Array<PolaroidSlot | null> = [null, null, null, null, null];

  if (heroImageUrl && destinationTitle) {
    defaults[0] = {
      imageUrl: heroImageUrl,
      alt: destinationTitle,
      caption: destinationTitle.toUpperCase(),
      subcaption: heroImageAttribution
        ? `PHOTO · ${heroImageAttribution.toUpperCase()}`
        : null,
      sourceType: "destination",
      sourceId: null,
    };
  }

  const activityPhotos = activities.filter((a) => a.photo_url);
  for (let i = 0; i < 3; i++) {
    const a = activityPhotos[i];
    if (!a?.photo_url) continue;
    defaults[1 + i] = {
      imageUrl: a.photo_url,
      alt: a.title,
      caption: a.title.toUpperCase(),
      subcaption: a.photo_attribution
        ? `PHOTO · ${a.photo_attribution.toUpperCase()}`
        : null,
      sourceType: "activity",
      sourceId: a.id,
    };
  }

  const latestCrew = recentPhotos.find((p) => p.image_url);
  if (latestCrew?.image_url) {
    const name = authorNameById.get(latestCrew.author_id) ?? "CREW";
    defaults[4] = {
      imageUrl: latestCrew.image_url,
      alt: latestCrew.caption ?? `Photo by ${name}`,
      caption: name.toUpperCase(),
      subcaption: relativeTimeLabel(latestCrew.created_at),
      sourceType: "post",
      sourceId: latestCrew.id,
    };
  }

  const overrideByIndex = new Map<number, PolaroidOverride>(
    overrides.map((o) => [o.index, o]),
  );

  const composed: PolaroidSlot[] = [];
  for (let i = 0; i < 5; i++) {
    const override = overrideByIndex.get(i);
    if (override) {
      composed.push({
        imageUrl: override.imageUrl,
        alt: override.caption ?? "Polaroid",
        caption: (override.caption ?? "").toUpperCase(),
        subcaption: override.subcaption ?? null,
        sourceType: override.sourceType,
        sourceId: override.sourceId ?? null,
      });
      continue;
    }
    const fallback = defaults[i];
    if (fallback) composed.push(fallback);
  }
  return composed;
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
  const [
    { data: bookings },
    { data: expenses },
    { count: crewCount },
    { data: activityPhotos },
    { data: recentPhotos },
  ] = await Promise.all([
    supabase.from("bookings").select("done").eq("trip_id", trip.id),
    supabase.from("expenses").select("amount").eq("trip_id", trip.id),
    supabase
      .from("trip_members")
      .select("user_id", { count: "exact", head: true })
      .eq("trip_id", trip.id),
    supabase
      .from("activities")
      .select("id, title, photo_url, photo_attribution")
      .eq("trip_id", trip.id)
      .not("photo_url", "is", null)
      .order("position", { ascending: true })
      .returns<
        Array<{
          id: string;
          title: string;
          photo_url: string | null;
          photo_attribution: string | null;
        }>
      >(),
    supabase
      .from("posts")
      .select("id, image_url, caption, author_id, created_at")
      .eq("trip_id", trip.id)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<
        Array<{
          id: string;
          image_url: string | null;
          caption: string | null;
          author_id: string;
          created_at: string;
        }>
      >(),
  ]);

  const recentPhotoAuthorIds = (recentPhotos ?? [])
    .map((p) => p.author_id)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const { data: recentPhotoAuthors } =
    recentPhotoAuthorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, name")
          .in("id", recentPhotoAuthorIds)
          .returns<Array<{ id: string; name: string }>>()
      : { data: [] as Array<{ id: string; name: string }> };
  const authorNameById = new Map(
    (recentPhotoAuthors ?? []).map((p) => [p.id, p.name]),
  );

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

  const activitiesWithPhotos = (activityPhotos ?? []).filter(
    (a): a is typeof a & { photo_url: string } => !!a.photo_url,
  );
  const postsWithImages = (recentPhotos ?? []).filter(
    (p): p is typeof p & { image_url: string } => !!p.image_url,
  );

  const overrides = trip.meta?.polaroid_slots ?? [];
  const polaroidSlots = composePolaroidSlots({
    destinationTitle: trip.destination,
    heroImageUrl: trip.hero_image_url,
    heroImageAttribution: trip.hero_image_attribution,
    activities: activitiesWithPhotos.slice(0, 4),
    recentPhotos: postsWithImages.slice(0, 4),
    authorNameById,
    overrides,
  });
  const overrideIndices = overrides.map((o) => o.index);
  const pickerActivities = activitiesWithPhotos.map((a) => ({
    id: a.id,
    title: a.title,
    photo_url: a.photo_url,
    photo_attribution: a.photo_attribution,
  }));
  const pickerPosts = postsWithImages.map((p) => ({
    id: p.id,
    image_url: p.image_url,
    caption: p.caption,
    author_id: p.author_id,
    created_at: p.created_at,
  }));
  const authorNameRecord = Object.fromEntries(authorNameById);

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
        media={
          polaroidSlots.length > 0 ? (
            <PolaroidStack
              slots={polaroidSlots}
              isAdmin={isAdmin}
              tripId={trip.id}
              pickerActivities={pickerActivities}
              pickerPosts={pickerPosts}
              authorNameById={authorNameRecord}
              overrideIndices={overrideIndices}
            />
          ) : null
        }
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
