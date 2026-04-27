import { notFound } from "next/navigation";
import { TripPreview } from "@/components/trips/TripPreview";
import { getSampleTripBySlug } from "@/lib/marketing/sampleTrips";

export const dynamic = "force-dynamic";

export default async function SampleTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = getSampleTripBySlug(slug);

  if (!trip) notFound();

  return (
    <TripPreview
      trip={{
        hero_title: trip.city,
        city_label: trip.city,
        dates_label: trip.datesLabel,
        target_budget_pp: trip.perHeadAmount,
        currency: trip.currency,
        crew_size: 6,
        origin: trip.origin,
        vibes: trip.vibesMeta,
      }}
      schedule={trip.schedule.map((row) => ({
        day: row.day,
        place: row.place,
        note: row.note,
      }))}
      totalDays={trip.totalDays}
      visibleDays={trip.visibleDays}
      variant={{
        kind: "sample",
        ribbonLabel: `Sample trip · ${trip.city}`,
      }}
    />
  );
}
