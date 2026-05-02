import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTrip } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Ledger } from "@/components/ledger/Ledger";
import type { Expense, ExpenseParticipant } from "@/lib/types";

export const dynamic = "force-dynamic";

type PhantomWarning = {
  shown?: boolean;
  target_crew_size?: number;
  joined_count?: number;
} | null;

export default async function LedgerPage({
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
  const [
    { data: expenses },
    { data: participants },
    { data: members },
    { data: tripMember },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, trip_id, description, amount, paid_by, created_at, original_currency, original_amount, fx_rate, fx_rate_source, fx_rate_date, fx_suggested_amount, fx_user_overridden, version, deleted_at",
      )
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false })
      .returns<Expense[]>(),
    supabase
      .from("expense_participants")
      .select("*")
      .eq("trip_id", trip.id)
      .is("deleted_at", null)
      .returns<ExpenseParticipant[]>(),
    supabase
      .from("trip_members")
      .select("user_id, profiles!trip_members_user_id_fkey(name)")
      .eq("trip_id", trip.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", trip.id)
      .eq("user_id", user.id)
      .maybeSingle<{ role: string }>(),
  ]);

  const crew =
    members?.flatMap((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0]
        : (row.profiles as { name?: string } | null);
      if (!profile?.name) return [];
      return [{ id: row.user_id, name: profile.name }];
    }) ?? [];

  const isAdmin = tripMember?.role === "admin";
  const phantomWarning =
    ((trip.meta as unknown as Record<string, unknown>)?.migration_warnings as
      | { ledger_v2_phantom_shares?: PhantomWarning }
      | undefined)?.ledger_v2_phantom_shares ?? null;

  const lead =
    trip.meta?.section_leads?.ledger ??
    "Pool everything, split even. Log what you pay, balances update.";

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader code="§ 05" title="Ledger." lead={lead} />
      <Ledger
        initial={expenses ?? []}
        participants={participants ?? []}
        crew={crew}
        tripId={trip.id}
        currentUserId={user.id}
        isAdmin={isAdmin}
        currency={trip.currency}
        phantomWarning={phantomWarning}
      />
    </section>
  );
}
