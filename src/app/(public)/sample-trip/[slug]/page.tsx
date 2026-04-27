import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { TripPreview } from "@/components/trips/TripPreview";
import { SAMPLE_LISBON } from "@/lib/marketing/sampleTrip";

export const dynamic = "force-dynamic";

type SampleTripRow = {
  hero_title: string | null;
  city_label: string | null;
  dates_label: string | null;
  target_budget_pp: number | null;
  currency: string | null;
  target_crew_size: number | null;
  meta: { origin?: string; vibes?: string } | null;
};

export default async function SampleTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "hero_title, city_label, dates_label, target_budget_pp, currency, target_crew_size, meta",
    )
    .eq("slug", slug)
    .maybeSingle<SampleTripRow>();

  if (!trip) notFound();

  const meta = trip.meta ?? {};

  return (
    <TripPreview
      trip={{
        hero_title: trip.hero_title,
        city_label: trip.city_label,
        dates_label: trip.dates_label,
        target_budget_pp: trip.target_budget_pp,
        currency: trip.currency,
        crew_size: trip.target_crew_size ?? SAMPLE_LISBON.specCells[1]
          ? Number(SAMPLE_LISBON.specCells[1].value)
          : 6,
        origin: meta.origin ?? "LHR",
        vibes: meta.vibes ?? "Foodie · Wine",
      }}
      schedule={SAMPLE_LISBON.schedule.map((row) => ({
        day: row.day,
        place: row.place,
        note: row.note,
      }))}
      totalDays={SAMPLE_LISBON.totalDays}
      visibleDays={SAMPLE_LISBON.totalDays}
      variant={{ kind: "sample", ribbonLabel: `Sample trip · ${slug}` }}
    />
  );
}
