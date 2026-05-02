import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { isPioneerForTrip } from "@/lib/plan";
import { Hero } from "@/components/layout/Hero";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SpecGrid } from "@/components/overview/SpecGrid";
import { Schedule } from "@/components/overview/Schedule";
import { LockAndDraftSection } from "@/components/overview/LockAndDraftSection";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { formatMoney } from "@/lib/currency";

export const dynamic = "force-dynamic";
// Lock & draft can take 20-40s with a Gemini retry. The action runs
// on this page's function invocation, so the page-level maxDuration
// applies. 90s gives headroom for one retry.
export const maxDuration = 90;

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

function tripDayCount(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
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
    isPioneer,
  ] = await Promise.all([
    supabase.from("bookings").select("done").eq("trip_id", trip.id),
    supabase.from("expenses").select("amount").eq("trip_id", trip.id),
    supabase
      .from("trip_members")
      .select("user_id", { count: "exact", head: true })
      .eq("trip_id", trip.id),
    user ? isPioneerForTrip(user.id, trip.id) : Promise.resolve(false),
  ]);

  const bookingsTotal = bookings?.length ?? 0;
  const bookingsDone = bookings?.filter((b) => b.done).length ?? 0;
  const kittyTotal =
    expenses?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  const planExists = !!trip.enriched_draft_generated_at;
  const briefStale =
    !!trip.meta?.brief_updated_at &&
    !!trip.enriched_draft_generated_at &&
    new Date(trip.meta.brief_updated_at).getTime() >
      new Date(trip.enriched_draft_generated_at).getTime();

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
        media={null}
      />

      <section className="py-14 pb-24 section-enter">
        <SectionHeader code="§ 01" title="The brief." lead={overviewLead} />

        {planExists ? (
          <CollapsibleSection
            storageKey={`tripcrew:brief-open:${trip.slug}`}
            defaultOpen={false}
            summary={
              <div className="flex items-center gap-3 flex-wrap">
                <span className="label-sm-wide text-fg-3">BRIEF</span>
                <span className="text-[14px] text-fg font-medium">
                  {[
                    trip.dates_label,
                    (() => {
                      const perHead = specCells.find((c) =>
                        c.label.toLowerCase().includes("head"),
                      );
                      if (typeof perHead?.amount === "number") {
                        return `${formatMoney(perHead.amount, trip.currency, { omitDecimals: true })}pp`;
                      }
                      return perHead?.value ? `${perHead.value}pp` : null;
                    })(),
                    (() => {
                      const days = tripDayCount(trip.start_date, trip.end_date);
                      return days ? `${days} day${days === 1 ? "" : "s"}` : null;
                    })(),
                    trip.city_label,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            }
          >
            <SpecGrid
              cells={specCells}
              isAdmin={isAdmin}
              tripId={trip.id}
              tripSlug={trip.slug}
              currency={trip.currency ?? "GBP"}
            />
            <Schedule
              rows={scheduleRows}
              isAdmin={isAdmin}
              tripId={trip.id}
              tripSlug={trip.slug}
              startDate={trip.start_date}
            />
          </CollapsibleSection>
        ) : (
          <>
            <SpecGrid
              cells={specCells}
              isAdmin={isAdmin}
              tripId={trip.id}
              tripSlug={trip.slug}
              currency={trip.currency ?? "GBP"}
            />
            <Schedule
              rows={scheduleRows}
              isAdmin={isAdmin}
              tripId={trip.id}
              tripSlug={trip.slug}
              startDate={trip.start_date}
            />
          </>
        )}
      </section>

      <LockAndDraftSection
        tripId={trip.id}
        userId={user?.id ?? null}
        isAdmin={isAdmin}
        destination={trip.destination}
        currency={trip.currency ?? "GBP"}
        enrichedDraft={trip.enriched_draft}
        enrichedDraftTier={trip.enriched_draft_tier}
        enrichedDraftGeneratedAt={trip.enriched_draft_generated_at}
        lastPriceRefreshAt={trip.last_price_refresh_at}
        livePricing={trip.meta?.live_pricing ?? null}
        briefStale={briefStale}
        draftProgress={trip.meta?.draft_progress ?? null}
        isPioneer={isPioneer}
        targetCrewSize={trip.target_crew_size}
        slug={trip.slug}
      />
    </>
  );
}
