import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CuratedTripView } from "@/components/marketing/CuratedTripView";
import { getCuratedTripBySlug } from "@/lib/marketing/curatedTrips";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = getCuratedTripBySlug(slug);
  if (!trip) return { title: "Tripcrew — curated trip" };
  return {
    title: `${trip.city} · Tripcrew curated`,
    description: `${trip.tagline} ${trip.totalDays} days, ${trip.crewLabel}, from ${trip.specCells.find((c) => c.label === "Per head")?.value ?? ""}.`,
  };
}

export default async function CuratedTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = getCuratedTripBySlug(slug);

  if (!trip) notFound();

  return <CuratedTripView trip={trip} />;
}
