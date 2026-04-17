import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { CrewList, type CrewRow } from "@/components/crew/CrewList";
import { InvitePanel } from "@/components/invites/InvitePanel";
import type { TripInvite } from "@/lib/types";

export const revalidate = 0;

export default async function CrewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(slug);
  if (!user) redirect("/sign-in");
  if (!trip) notFound();

  const member = await getTripMember(trip.id, user.id);
  const isAdmin = member?.role === "admin";

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
  const target = trip.target_crew_size;
  const remaining = target ? target - count : null;
  const lead =
    count === 0
      ? "Nobody in yet. Invite the crew."
      : remaining !== null
        ? remaining <= 0
          ? "Roster full."
          : `${count} in, ${remaining} to go.`
        : `${count} in.`;

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader code="§ 02" title="Crew." lead={lead} />

      <div className="flex justify-between items-baseline mb-6 font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
        <span>
          <b className="text-fg text-[14px] font-medium font-sans tracking-[-0.01em] normal-case mr-1">
            {count}
          </b>
          {target ? `/ ${target} confirmed` : "confirmed"}
        </span>
        <span>Invite-only</span>
      </div>

      <CrewList
        initial={rows}
        tripId={trip.id}
        targetCrew={target}
        currentUserId={user.id}
      />

      {isAdmin && <AdminInvites tripId={trip.id} />}
    </section>
  );
}

async function AdminInvites({ tripId }: { tripId: string }) {
  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("trip_invites")
    .select(
      "id, trip_id, email, invited_by, invited_at, accepted_at, token, expires_at, accepted_by",
    )
    .eq("trip_id", tripId)
    .is("accepted_at", null)
    .order("invited_at", { ascending: false })
    .returns<TripInvite[]>();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <InvitePanel tripId={tripId} origin={origin} initial={invites ?? []} />
  );
}
