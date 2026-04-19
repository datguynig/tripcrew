import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import type { AiUsage } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Owner-only cost telemetry dashboard for the AI draft beta.
 * Gated by AI_BETA_OWNER_EMAIL env var — if the current user's email
 * doesn't match, we 404 so the route isn't discoverable.
 */

type UsageWithTrip = AiUsage & {
  trips: { slug: string; name: string } | null;
  profiles: { name: string } | null;
};

export default async function AiUsagePage() {
  const ownerEmail = process.env.AI_BETA_OWNER_EMAIL;
  if (!ownerEmail) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.email?.toLowerCase() !== ownerEmail.toLowerCase()) notFound();

  const service = createServiceClient();
  const { data: rows } = await service
    .from("ai_usage")
    .select(
      "*, trips!inner(slug, name), profiles!ai_usage_user_id_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<UsageWithTrip[]>();

  const usage = rows ?? [];
  const totalSpend = usage.reduce(
    (sum, r) => sum + Number(r.total_cost_usd ?? 0),
    0,
  );
  const totalDrafts = usage.length;
  const totalTripsDrafted = new Set(usage.map((r) => r.trip_id)).size;

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const last24hSpend = usage
    .filter((r) => new Date(r.created_at).getTime() >= dayAgo)
    .reduce((sum, r) => sum + Number(r.total_cost_usd ?? 0), 0);

  const over = last24hSpend > 20;

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ ¤"
        title="AI usage."
        lead="Closed-beta cost telemetry. Only visible to the owner."
      />

      <div className="grid grid-cols-4 max-[780px]:grid-cols-2 border border-line mb-8">
        <StatCell
          label="Total spend"
          value={`$${totalSpend.toFixed(2)}`}
          sub="All-time"
        />
        <StatCell
          label="Last 24h"
          value={`$${last24hSpend.toFixed(2)}`}
          sub="Past day"
          tone={over ? "err" : undefined}
        />
        <StatCell
          label="Drafts"
          value={totalDrafts.toString()}
          sub="Total runs"
        />
        <StatCell
          label="Trips"
          value={totalTripsDrafted.toString()}
          sub="Unique drafted"
        />
      </div>

      {over && (
        <div className="border border-err/40 bg-err/[0.06] p-4 mb-6 font-mono text-[11px] tracking-[0.1em] uppercase text-err">
          Daily spend over $20 — check prompt efficiency or tighten rate limits
        </div>
      )}

      {usage.length === 0 ? (
        <div className="border border-line py-14 text-center label text-fg-3">
          No drafts logged yet
        </div>
      ) : (
        <div className="border border-line overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-fg-3 label-sm">
                <th className="text-left py-3 px-4">When</th>
                <th className="text-left py-3 px-4">Trip</th>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-right py-3 px-4">Input</th>
                <th className="text-right py-3 px-4">Output</th>
                <th className="text-right py-3 px-4">Think</th>
                <th className="text-right py-3 px-4">Places</th>
                <th className="text-right py-3 px-4">$ Total</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-line last:border-b-0 tabular"
                >
                  <td className="py-3 px-4 font-mono text-[11px] text-fg-2">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-medium">
                    {r.trips?.name ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-fg-2">
                    {r.profiles?.name ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-fg-2">
                    {r.input_tokens?.toLocaleString() ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-fg-2">
                    {r.output_tokens?.toLocaleString() ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-fg-3">
                    {r.thinking_tokens?.toLocaleString() ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-fg-2">
                    {r.places_requests ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    ${Number(r.total_cost_usd ?? 0).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "err";
}) {
  return (
    <div className="p-6 border-r border-b border-line last:border-r-0 max-[780px]:[&:nth-child(2n)]:border-r-0 max-[780px]:[&:nth-child(-n+2)]:border-b max-[780px]:[&:nth-child(-n+2)]:border-line">
      <div className="label-sm-wide text-fg-3 mb-2.5">{label}</div>
      <div
        className={`display-md tabular ${tone === "err" ? "text-err" : ""}`}
      >
        {value}
      </div>
      <div className="body-sm text-fg-2 mt-1.5 font-mono tracking-[0.05em]">
        {sub}
      </div>
    </div>
  );
}
