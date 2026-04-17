import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrip } from "@/lib/auth";
import { Hero } from "@/components/layout/Hero";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SpecGrid } from "@/components/overview/SpecGrid";
import { Schedule } from "@/components/overview/Schedule";

export const revalidate = 0;

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

  const headline = trip.destination ?? trip.name;
  const heroSub = trip.meta?.hero_sub ?? null;
  const specCells = trip.meta?.spec_grid ?? [];
  const scheduleRows = trip.meta?.schedule ?? [];
  const targetBudgetPp = trip.meta?.target_budget_pp ?? null;

  return (
    <>
      <Hero
        headline={headline}
        heroSub={heroSub}
        destination={trip.destination}
        startDate={trip.start_date}
        endDate={trip.end_date}
        status={trip.status}
        crewCount={crewCount ?? 0}
        targetCrew={trip.target_crew_size}
        bookingsDone={bookingsDone}
        bookingsTotal={bookingsTotal}
        kittyTotal={kittyTotal}
        targetBudgetPp={targetBudgetPp}
      />

      <section className="py-14 pb-24 section-enter">
        <SectionHeader
          code="§ 01"
          title="The brief."
          lead="Spec grid and schedule for the trip. Admin can edit in settings."
        />
        <SpecGrid cells={specCells} />
        <Schedule rows={scheduleRows} />
      </section>
    </>
  );
}
