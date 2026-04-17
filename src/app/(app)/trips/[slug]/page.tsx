import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrip } from "@/lib/auth";
import { Hero } from "@/components/layout/Hero";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SpecGrid } from "@/components/overview/SpecGrid";
import { Schedule } from "@/components/overview/Schedule";

export const revalidate = 0;

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
  const trip = await getTrip(slug);
  if (!trip) notFound();

  if (trip.status === "planning") {
    redirect(`/trips/${trip.slug}/destinations`);
  }

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

  const heroTitle = trip.hero_title ?? trip.destination ?? trip.name;
  const heroSubtitle = trip.hero_subtitle;
  const cityLabel = trip.city_label ?? trip.destination ?? "TBD";
  const datesLabel =
    trip.dates_label ?? formatDateRange(trip.start_date, trip.end_date);
  const specCells = trip.meta?.spec ?? [];
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
      />

      <section className="py-14 pb-24 section-enter">
        <SectionHeader code="§ 01" title="The brief." lead={overviewLead} />
        <SpecGrid cells={specCells} />
        <Schedule rows={scheduleRows} />
      </section>
    </>
  );
}
