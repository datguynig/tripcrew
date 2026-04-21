import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/layout/Nav";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const trip = await getTrip(slug);
  if (!trip) notFound();

  const member = await getTripMember(trip.id, user.id);
  if (!member) redirect("/");

  const ambientStyle = trip.hero_tint
    ? ({ "--trip-tint": trip.hero_tint } as CSSProperties)
    : undefined;

  return (
    <div className="trip-ambient" style={ambientStyle}>
      <Nav
        slug={trip.slug}
        tripId={trip.id}
        isAdmin={member.role === "admin"}
      />
      {children}
    </div>
  );
}
