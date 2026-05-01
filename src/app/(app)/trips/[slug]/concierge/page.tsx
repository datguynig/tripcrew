import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Concierge } from "@/components/concierge/Concierge";
import { ConciergeUpsell } from "@/components/concierge/ConciergeUpsell";
import type { ConciergeMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConciergePage({
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
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("founding_crew_at, name")
    .eq("id", user.id)
    .maybeSingle<{ founding_crew_at: string | null; name: string | null }>();

  const isPioneer = !!profileRow?.founding_crew_at;

  if (!isPioneer) {
    return (
      <section className="py-12 pb-24">
        <SectionHeader code="Concierge" title="Plan by talking." />
        <ConciergeUpsell />
      </section>
    );
  }

  const service = createServiceClient();
  const { data: messages } = await service
    .from("concierge_messages")
    .select("*")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(50)
    .returns<ConciergeMessage[]>();

  return (
    <section className="py-12 pb-24">
      <SectionHeader
        code="Concierge"
        title="Plan by talking."
        lead="Refine your trip in chat. The concierge can search venues, suggest swaps, and propose changes you can apply with one click."
      />
      <Concierge
        tripId={trip.id}
        initialMessages={messages ?? []}
        userName={profileRow?.name ?? "you"}
      />
    </section>
  );
}
