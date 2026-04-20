import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip, getTripMember } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { IdentitySection } from "@/components/admin/IdentitySection";
import { DatesBudgetSection } from "@/components/admin/DatesBudgetSection";
import { SectionLeadsSection } from "@/components/admin/SectionLeadsSection";
import { AdminRedraftSection } from "@/components/admin/AdminRedraftSection";
import { getRedraftAvailability } from "@/lib/actions/aiDraft";
import { aiEnabled as aiConfigured } from "@/lib/ai";
import { placesEnabled } from "@/lib/places";
import {
  CrewManagement,
  type AdminCrewMember,
} from "@/components/admin/CrewManagement";
import { DangerZone } from "@/components/admin/DangerZone";
import type { TripRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const trip = await getTrip(slug);
  if (!trip) notFound();

  const member = await getTripMember(trip.id, user.id);
  if (!member || member.role !== "admin") redirect(`/trips/${trip.slug}`);

  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("user_id, role, joined_at, profiles!trip_members_user_id_fkey(name)")
    .eq("trip_id", trip.id)
    .order("joined_at", { ascending: true });

  const crew: AdminCrewMember[] =
    memberRows?.flatMap((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : (row.profiles as { name?: string } | null);
      if (!profile?.name) return [];
      return [
        {
          user_id: row.user_id,
          name: profile.name,
          role: row.role as TripRole,
          member_joined_at: row.joined_at,
        },
      ];
    }) ?? [];

  const showRedraft =
    trip.ai_drafted_at !== null &&
    user.profile.ai_enabled &&
    aiConfigured() &&
    placesEnabled() &&
    !!trip.destination;
  const redraftAvailability = showRedraft
    ? await getRedraftAvailability(trip.id)
    : null;
  const { count: crewCount } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 07"
        title="Admin."
        lead="Trip settings and crew management. Hero, spec grid, and schedule are edited inline on Overview."
      />

      <div className="grid gap-10">
        <AdminCard
          code="A"
          title="Identity"
          description="Name and destination. Name is shown on the topbar and dashboard; destination becomes the overview headline."
        >
          <IdentitySection
            tripId={trip.id}
            name={trip.name}
            destination={trip.destination}
          />
        </AdminCard>

        <AdminCard
          code="B"
          title="Dates & budget"
          description="Start/end dates, vote deadline, target budget per head."
        >
          <DatesBudgetSection
            tripId={trip.id}
            startDate={trip.start_date}
            endDate={trip.end_date}
            voteDeadline={trip.vote_deadline}
            targetBudgetPp={trip.target_budget_pp}
            targetCrewSize={trip.target_crew_size}
            currency={trip.currency}
          />
        </AdminCard>

        <AdminCard
          code="C"
          title="Section leads"
          description="Short intro under the title on Overview, Shortlist, Bookings, Ledger, Feed."
        >
          <SectionLeadsSection
            tripId={trip.id}
            leads={trip.meta?.section_leads ?? {}}
          />
        </AdminCard>

        {showRedraft && trip.destination && (
          <AdminCard
            code="D"
            title="AI draft"
            description="Redraft the entire trip. Wipes AI-generated hero, spec, schedule, activities, and bookings — keeps manual edits on non-AI rows. For surgical edits, use the rail on Overview instead."
          >
            <AdminRedraftSection
              tripId={trip.id}
              destination={trip.destination}
              crewCount={crewCount ?? 0}
              currency={trip.currency ?? "GBP"}
              targetBudgetPp={trip.target_budget_pp}
              existingPreferences={trip.meta?.ai_preferences ?? null}
              lastDraftedAt={trip.ai_drafted_at}
              canRedraft={redraftAvailability?.ok ?? false}
              blockedReason={
                redraftAvailability?.ok
                  ? null
                  : redraftAvailability?.reason ?? null
              }
            />
          </AdminCard>
        )}

        <AdminCard
          code={showRedraft ? "E" : "D"}
          title="Crew management"
          description="Promote, demote, remove members. Delete the trip."
        >
          <div className="grid gap-6">
            <CrewManagement
              tripId={trip.id}
              currentUserId={user.id}
              members={crew}
            />
            <DangerZone tripId={trip.id} tripName={trip.name} />
          </div>
        </AdminCard>
      </div>
    </section>
  );
}
