import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { BookingsList } from "@/components/bookings/BookingsList";
import type { Booking } from "@/lib/types";

export const revalidate = 0;

export default async function BookingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(slug);
  if (!user) redirect("/sign-in");
  if (!trip) notFound();

  const supabase = await createClient();
  const [{ data: bookings }, { data: members }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, trip_id, title, assignee_id, done, position, created_at, created_by",
      )
      .eq("trip_id", trip.id)
      .order("position", { ascending: true })
      .returns<Booking[]>(),
    supabase
      .from("trip_members")
      .select("user_id, profiles!trip_members_user_id_fkey(name)")
      .eq("trip_id", trip.id)
      .order("joined_at", { ascending: true }),
  ]);

  const crew =
    members?.flatMap((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : (row.profiles as { name?: string } | null);
      if (!profile?.name) return [];
      return [{ id: row.user_id, name: profile.name }];
    }) ?? [];

  const done = bookings?.filter((b) => b.done).length ?? 0;
  const total = bookings?.length ?? 0;

  const lead =
    trip.meta?.section_leads?.bookings ??
    "The checklist. Claim one, book it, tick it. Simple accountability.";

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code={`§ 04 · ${done}/${total}`}
        title="Bookings."
        lead={lead}
      />
      <BookingsList initial={bookings ?? []} crew={crew} tripId={trip.id} />
    </section>
  );
}
