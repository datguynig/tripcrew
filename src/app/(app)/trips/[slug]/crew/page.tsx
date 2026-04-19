import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { CrewList, type CrewRow } from "@/components/crew/CrewList";
import { InvitePanel } from "@/components/invites/InvitePanel";
import { PriorCrewChips } from "@/components/invites/PriorCrewChips";
import type { TripInvite } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    .select("user_id, joined_at, profiles!trip_members_user_id_fkey(name)")
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

      <div className="flex justify-between items-baseline mb-6 label text-fg-3">
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

      {isAdmin && (
        <AdminInvites tripId={trip.id} currentUserId={user.id} />
      )}
    </section>
  );
}

async function getPriorCrew(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentUserId: string,
  currentTripId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data: myMemberships } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", currentUserId);

  const otherTripIds =
    myMemberships
      ?.map((m) => m.trip_id as string)
      .filter((id) => id !== currentTripId) ?? [];
  if (otherTripIds.length === 0) return [];

  const { data: peers } = await supabase
    .from("trip_members")
    .select("user_id")
    .in("trip_id", otherTripIds)
    .neq("user_id", currentUserId);

  const { data: currentMembers } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", currentTripId);

  const currentIds = new Set(
    (currentMembers ?? []).map((m) => m.user_id as string),
  );
  const candidateIds = Array.from(
    new Set((peers ?? []).map((m) => m.user_id as string)),
  ).filter((id) => !currentIds.has(id));
  if (candidateIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", candidateIds)
    .order("name", { ascending: true });

  return (profiles ?? []).filter(
    (p): p is { id: string; name: string } =>
      typeof p.id === "string" && typeof p.name === "string",
  );
}

async function AdminInvites({
  tripId,
  currentUserId,
}: {
  tripId: string;
  currentUserId: string;
}) {
  const supabase = await createClient();
  const [{ data: invites }, priors] = await Promise.all([
    supabase
      .from("trip_invites")
      .select(
        "id, trip_id, email, invited_by, invited_at, accepted_at, token, expires_at, accepted_by",
      )
      .eq("trip_id", tripId)
      .is("accepted_at", null)
      .order("invited_at", { ascending: false })
      .returns<TripInvite[]>(),
    getPriorCrew(supabase, currentUserId, tripId),
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <>
      <PriorCrewChips tripId={tripId} people={priors} />
      <InvitePanel tripId={tripId} origin={origin} initial={invites ?? []} />
    </>
  );
}
