import { createClient } from "@/lib/supabase/server";
import { getTrip } from "@/lib/auth";
import { Hero } from "@/components/layout/Hero";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SpecGrid } from "@/components/overview/SpecGrid";
import { Schedule } from "@/components/overview/Schedule";
import { SECTION_LEADS, TARGET_BUDGET_PP } from "@/constants/trip";

export const revalidate = 0;

export default async function OverviewPage() {
  const trip = await getTrip();
  if (!trip) {
    throw new Error("Trip not found. Run schema.sql + seeds.");
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

  return (
    <>
      <Hero
        crewCount={crewCount ?? 0}
        targetCrew={trip.target_crew_size}
        bookingsDone={bookingsDone}
        bookingsTotal={bookingsTotal}
        kittyTotal={kittyTotal}
        targetBudgetPp={TARGET_BUDGET_PP}
      />

      <section className="py-14 pb-24 section-enter">
        <SectionHeader
          code="§ 01"
          title="The brief."
          lead={SECTION_LEADS.overview}
        />
        <SpecGrid />
        <Schedule />
      </section>
    </>
  );
}
