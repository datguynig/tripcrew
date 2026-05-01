import Link from "next/link";
import {
  acceptAndRedirect,
  lookupInvite,
} from "@/lib/actions/acceptInvite";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TripPreview } from "@/components/trips/TripPreview";
import type { TripPreviewSchedule } from "@/components/trips/TripPreview";

export const revalidate = 0;

const FALLBACK_SCHEDULE: TripPreviewSchedule = [
  {
    day: "Day 1",
    place: "Arrival",
    note: "The crew lands. Unpacking, coffee, a slow first walk.",
  },
  {
    day: "Day 2",
    place: "First full day",
    note: "Plan kicks in. AI-drafted, crew-voted.",
  },
  {
    day: "Day 3",
    place: "The big one",
    note: "The day everyone said yes to.",
  },
];

type JoinTripRow = {
  id: string;
  hero_title: string | null;
  city_label: string | null;
  dates_label: string | null;
  target_budget_pp: number | null;
  currency: string | null;
  target_crew_size: number | null;
  start_date: string | null;
  end_date: string | null;
  meta: { origin?: string; vibes?: string } | null;
};

type JoinMemberRow = {
  user_id: string;
  role: string;
  profiles: { name: string | null } | { name: string | null }[] | null;
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lookup = await lookupInvite(token);
  if (lookup.kind !== "ok") {
    return <JoinError kind={lookup.kind} />;
  }

  // Authed user: defer entirely to the existing accept flow. It redirects
  // to /trips/<slug> on success or back to /join/<token> on error, so we
  // never return from this branch.
  if (user) {
    await acceptAndRedirect(token);
  }

  const service = createServiceClient();
  const { data: trip } = await service
    .from("trips")
    .select(
      "id, hero_title, city_label, dates_label, target_budget_pp, currency, target_crew_size, start_date, end_date, meta",
    )
    .eq("id", lookup.tripId)
    .maybeSingle<JoinTripRow>();

  if (!trip) {
    return <JoinError kind="trip-missing" />;
  }

  const { data: members } = await service
    .from("trip_members")
    .select("user_id, role, profiles!inner(name)")
    .eq("trip_id", trip.id);

  const crewMembers = (members ?? []).slice(0, 5).map((m: JoinMemberRow) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const fullName = profile?.name ?? "Crew";
    const parts = fullName.split(" ").filter(Boolean);
    const initials = parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
    return {
      name: parts[0] ?? fullName,
      initials: initials || fullName.slice(0, 2).toUpperCase(),
    };
  });

  const inviterName = lookup.inviterName ?? "A friend";
  const meta = trip.meta ?? {};
  const totalDays = computeTripDays(trip.start_date, trip.end_date) ?? 6;

  return (
    <TripPreview
      trip={{
        hero_title: trip.hero_title,
        city_label: trip.city_label,
        dates_label: trip.dates_label,
        target_budget_pp: trip.target_budget_pp,
        currency: trip.currency,
        crew_size: trip.target_crew_size ?? Math.max(crewMembers.length, 1),
        origin: meta.origin ?? "LHR",
        vibes: meta.vibes ?? "Crew trip",
      }}
      schedule={FALLBACK_SCHEDULE}
      totalDays={totalDays}
      visibleDays={3}
      variant={{
        kind: "invite",
        inviterName,
        inviterAvatarUrl: null,
        crewMembers,
        ctaHref: `/sign-in?next=${encodeURIComponent(`/join/${token}`)}`,
      }}
    />
  );
}

function computeTripDays(
  startIso: string | null,
  endIso: string | null,
): number | null {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function JoinError({ kind }: { kind: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    expired: {
      title: "Invite expired.",
      body: "Ask the inviter for a fresh link.",
    },
    "trip-missing": {
      title: "Trip no longer exists.",
      body: "It may have been deleted by the admin.",
    },
    invalid: { title: "Invite not found.", body: "Double-check the link." },
  };
  const msg = messages[kind] ?? messages.invalid;
  return (
    <div className="min-h-screen bg-cream text-ink flex items-center justify-center px-7">
      <div className="text-center flex flex-col gap-3 max-w-[460px]">
        <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-ink/60">
          Crew invite
        </p>
        <h1 className="font-serif text-[36px] tracking-[-0.02em]">
          {msg.title}
        </h1>
        <p className="text-[15px] leading-[1.55] text-ink/70">{msg.body}</p>
        <Link
          href="/"
          className="mt-4 font-mono uppercase tracking-[0.18em] text-[11px] text-ink/60 hover:text-ink"
        >
          Back to home →
        </Link>
      </div>
    </div>
  );
}
