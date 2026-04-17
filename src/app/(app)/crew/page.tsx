import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { CrewList, type CrewRow } from "@/components/crew/CrewList";
import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function CrewPage() {
  const user = await getCurrentUser();
  const trip = await getTrip();
  if (!user) redirect("/sign-in");
  if (!trip) throw new Error("Trip not found");

  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_members")
    .select("user_id, joined_at, profiles(name)")
    .eq("trip_id", trip.id)
    .order("joined_at", { ascending: true });

  const rows: CrewRow[] =
    data?.flatMap((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : (row.profiles as { name?: string } | null);
      if (!profile?.name) return [];
      return [
        {
          user_id: row.user_id,
          name: profile.name,
          member_joined_at: row.joined_at,
        },
      ];
    }) ?? [];

  const count = rows.length;
  const remaining = trip.target_crew_size - count;
  const lead =
    count === 0
      ? "Nobody in yet. Share the link."
      : remaining <= 0
        ? "Roster locked."
        : `${count} in, ${remaining} to go.`;

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader code="§ 02" title="Crew." lead={lead} />

      <div className="flex justify-between items-baseline mb-6 font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
        <span>
          <b className="text-fg text-[14px] font-medium font-sans tracking-[-0.01em] normal-case mr-1">
            {count}
          </b>
          / {trip.target_crew_size} confirmed
        </span>
        <span>Auto-added on sign-in</span>
      </div>

      <CrewList
        initial={rows}
        tripId={trip.id}
        targetCrew={trip.target_crew_size}
        currentUserId={user.id}
      />
    </section>
  );
}
