import { notFound } from "next/navigation";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreApplication } from "@/lib/applications/scoring";
import { ApplicationRow } from "@/components/admin/ApplicationRow";
import type {
  Application,
  ApplicationBudgetAttitude,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type QueueFilter = "pending" | "approved" | "rejected" | "all";

const FILTERS: ReadonlyArray<QueueFilter> = [
  "pending",
  "approved",
  "rejected",
  "all",
];

function parseFilter(raw: string | string[] | undefined): QueueFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return FILTERS.includes(value as QueueFilter)
    ? (value as QueueFilter)
    : "pending";
}

type QueueRow = Pick<
  Application,
  | "id"
  | "email"
  | "created_at"
  | "trips_per_year"
  | "role"
  | "pain"
  | "budget_attitude"
  | "approved_at"
  | "rejected_at"
>;

type DecoratedRow = {
  application: Pick<
    Application,
    "id" | "email" | "created_at" | "role" | "budget_attitude"
  >;
  score: number;
};

type PageProps = {
  searchParams: Promise<{ filter?: string | string[] }>;
};

export default async function ApplicationsQueuePage({ searchParams }: PageProps) {
  try {
    await requireFounder();
  } catch (err) {
    if (err instanceof FounderForbiddenError) notFound();
    throw err;
  }

  const params = await searchParams;
  const filter = parseFilter(params.filter);

  const supabase = createServiceClient();

  let query = supabase
    .from("applications")
    .select(
      "id, email, created_at, trips_per_year, role, pain, budget_attitude, approved_at, rejected_at",
    )
    .order("created_at", { ascending: false });

  if (filter === "pending") {
    query = query.is("approved_at", null).is("rejected_at", null);
  } else if (filter === "approved") {
    query = query.not("approved_at", "is", null);
  } else if (filter === "rejected") {
    query = query.not("rejected_at", "is", null);
  }

  const { data: rows } = await query.returns<QueueRow[]>();

  const decorated: DecoratedRow[] = (rows ?? [])
    .map((row) => ({
      application: {
        id: row.id,
        email: row.email,
        created_at: row.created_at,
        role: row.role as ApplicationRole,
        budget_attitude: row.budget_attitude as ApplicationBudgetAttitude,
      },
      score: scoreApplication({
        trips_per_year: row.trips_per_year as ApplicationTripsPerYear,
        role: row.role as ApplicationRole,
        budget_attitude: row.budget_attitude as ApplicationBudgetAttitude,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const [{ count: pendingCount }, { count: totalCount }] = await Promise.all([
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .is("approved_at", null)
      .is("rejected_at", null),
    supabase.from("applications").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="min-h-screen bg-ink text-cream">
      <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
        <header className="flex flex-col gap-4 border-b border-cream/15 pb-6 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-3xl tracking-tight md:text-[2.5rem]">
            Applications · Queue
          </h1>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream/60">
            {pendingCount ?? 0} pending · {totalCount ?? 0} total
          </div>
        </header>

        <nav
          aria-label="Filter applications"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          {FILTERS.map((value) => {
            const active = value === filter;
            return (
              <a
                key={value}
                href={`/admin/applications/queue?filter=${value}`}
                className={[
                  "border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                  active
                    ? "border-marketing-coral text-marketing-coral"
                    : "border-cream/30 text-cream/65 hover:border-cream/60 hover:text-cream",
                ].join(" ")}
              >
                {value}
              </a>
            );
          })}
        </nav>

        <div className="mt-6 border border-cream/15">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-cream/15 bg-cream/[0.03]">
                <th className="px-4 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                  Submitted
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                  Budget
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                  Score
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {decorated.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-cream/40"
                  >
                    No applications.
                  </td>
                </tr>
              ) : (
                decorated.map((row) => (
                  <ApplicationRow
                    key={row.application.id}
                    application={row.application}
                    score={row.score}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
