import { notFound } from "next/navigation";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type AnalyticsRow = {
  id: string;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  approved_at: string | null;
  first_paid_at: string | null;
  utm_source: string | null;
};

type SegmentRow = {
  segment: string;
  total: number;
  paid: number;
  rate: number;
};

function aggregate<T extends { first_paid_at: string | null }>(
  apps: T[],
  groupBy: (r: T) => string,
): SegmentRow[] {
  const acc = new Map<string, { total: number; paid: number }>();
  for (const r of apps) {
    const key = groupBy(r);
    const prev = acc.get(key) ?? { total: 0, paid: 0 };
    prev.total += 1;
    if (r.first_paid_at) prev.paid += 1;
    acc.set(key, prev);
  }
  return [...acc.entries()]
    .map(([segment, { total, paid }]) => ({
      segment,
      total,
      paid,
      rate: total === 0 ? 0 : paid / total,
    }))
    .sort((a, b) => b.rate - a.rate);
}

export default async function ApplicationsAnalyticsPage() {
  try {
    await requireFounder();
  } catch (err) {
    if (err instanceof FounderForbiddenError) notFound();
    throw err;
  }

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from("applications")
    .select(
      "id, role, pain, budget_attitude, approved_at, first_paid_at, utm_source",
    )
    .returns<AnalyticsRow[]>();

  const apps = rows ?? [];
  const total = apps.length;
  const approved = apps.filter((r) => r.approved_at).length;
  const paid = apps.filter((r) => r.first_paid_at).length;

  const byBudget = aggregate(apps, (r) => r.budget_attitude);
  const byRole = aggregate(apps, (r) => r.role);
  const byPain = aggregate(apps, (r) => r.pain);
  const bySource = aggregate(apps, (r) => r.utm_source ?? "direct");

  return (
    <div className="min-h-screen bg-ink text-cream">
      <div className="mx-auto max-w-[1100px] px-6 py-12 md:px-10 md:py-16">
        <header className="flex flex-col gap-2 border-b border-cream/15 pb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cream/55">
            Admin
          </p>
          <h1 className="font-serif text-3xl tracking-tight md:text-[2.5rem]">
            Applications · Analytics
          </h1>
        </header>

        <section className="mt-12 grid grid-cols-1 border-2 border-cream/30 sm:grid-cols-3">
          <FunnelStat label="Submitted" value={total} />
          <FunnelStat label="Approved" value={approved} borderLeft />
          <FunnelStat label="Paid" value={paid} borderLeft />
        </section>

        <div className="mt-12 flex flex-col gap-12">
          <SegmentTable title="Paid rate by budget" rows={byBudget} />
          <SegmentTable title="Paid rate by role" rows={byRole} />
          <SegmentTable title="Paid rate by pain" rows={byPain} />
          <SegmentTable title="Paid rate by source" rows={bySource} />
        </div>
      </div>
    </div>
  );
}

function FunnelStat({
  label,
  value,
  borderLeft = false,
}: {
  label: string;
  value: number;
  borderLeft?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col gap-3 px-6 py-8 md:px-8 md:py-10",
        borderLeft ? "border-t border-cream/30 sm:border-t-0 sm:border-l" : "",
      ].join(" ")}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cream/55">
        {label}
      </p>
      <p className="font-serif text-[3rem] leading-none tracking-tight tabular-nums md:text-[3.5rem]">
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}

function SegmentTable({
  title,
  rows,
}: {
  title: string;
  rows: SegmentRow[];
}) {
  return (
    <section>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-cream/65">
        {title}
      </p>
      <div className="border border-cream/15">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-cream/15 bg-cream/[0.03]">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                Segment
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                Total
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                Paid
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-cream/50">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-cream/40"
                >
                  No data yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.segment}
                  className="border-b border-cream/10 last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-cream">
                    {row.segment}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-cream/80">
                    {row.total}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-cream/80">
                    {row.paid}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12px] tabular-nums text-marketing-coral">
                    {(row.rate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
