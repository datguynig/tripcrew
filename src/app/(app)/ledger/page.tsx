import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Ledger } from "@/components/ledger/Ledger";
import { SECTION_LEADS } from "@/constants/trip";
import type { Expense } from "@/lib/types";

export const revalidate = 0;

export default async function LedgerPage() {
  const user = await getCurrentUser();
  const trip = await getTrip();
  if (!user) redirect("/sign-in");
  if (!trip) throw new Error("Trip not found");

  const supabase = await createClient();
  const [{ data: expenses }, { data: members }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, trip_id, description, amount, paid_by, created_at")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false })
      .returns<Expense[]>(),
    supabase
      .from("trip_members")
      .select("user_id, profiles(name)")
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

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ 05"
        title="Ledger."
        lead={SECTION_LEADS.ledger}
      />
      <Ledger
        initial={expenses ?? []}
        crew={crew}
        tripId={trip.id}
        currentUserId={user.id}
      />
    </section>
  );
}
