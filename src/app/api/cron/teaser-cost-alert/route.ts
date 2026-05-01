/**
 * Cost-ceiling alert cron.
 *
 * Sums ai_usage.estimated_cost_gbp for feature='curated_teaser' over the
 * last 24h. If the total exceeds the daily limit, sends an alert email to
 * AI_BETA_OWNER_EMAIL so the owner can investigate (e.g. pause the public
 * teaser flow, raise the IP throttle, or rotate keys).
 *
 * Manual verification (after migrations are applied):
 *   1. Insert a synthetic high-cost row:
 *        INSERT INTO ai_usage (operation, provider, feature, model,
 *          estimated_cost_gbp, succeeded)
 *        VALUES ('curated_teaser', 'gemini', 'curated_teaser',
 *          'gemini-3-flash', 50.0, true);
 *   2. Hit the cron:
 *        curl -H "Authorization: Bearer $CRON_SECRET" \
 *          /api/cron/teaser-cost-alert
 *   3. Expect { total: 50, limit: 40, alerted: true } and an email to
 *      AI_BETA_OWNER_EMAIL.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAILY_LIMIT_GBP = 40;

type CostRow = { estimated_cost_gbp: number | null };

async function sendCostAlert(
  to: string,
  total: number,
  limit: number,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.TEASER_EMAIL_FROM ?? "Yenkoh <hello@yenkoh.com>";

  if (!apiKey) {
    console.warn(
      "[cron/teaser-cost-alert] RESEND_API_KEY missing — skipping alert send",
      { to, total, limit },
    );
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yenkoh.com";
  const subject = `[ALERT] Curated teaser cost over £${limit} in 24h`;
  const text = [
    `Curated teaser AI spend has crossed the daily ceiling.`,
    ``,
    `Last 24h total: £${total.toFixed(2)}`,
    `Daily limit: £${limit.toFixed(2)}`,
    ``,
    `Investigate at: ${siteUrl}/ai-usage`,
    ``,
    `Likely culprits: a viral burst, a stuck loop, or a leaked endpoint.`,
    `Consider rotating GEMINI_API_KEY or pausing the public teaser flow.`,
    ``,
    `Yenkoh cron`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[cron/teaser-cost-alert] Resend send failed", {
      to,
      status: response.status,
      body,
    });
    throw new Error("teaser cost alert send failed");
  }
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/teaser-cost-alert] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ownerEmail = process.env.AI_BETA_OWNER_EMAIL;
  if (!ownerEmail) {
    console.error(
      "[cron/teaser-cost-alert] AI_BETA_OWNER_EMAIL is not configured.",
    );
    return NextResponse.json(
      { error: "Owner email not configured." },
      { status: 500 },
    );
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ai_usage")
    .select("estimated_cost_gbp")
    .eq("feature", "curated_teaser")
    .gt("created_at", since)
    .returns<CostRow[]>();

  if (error) {
    console.error("[cron/teaser-cost-alert] usage query failed", error);
    return NextResponse.json(
      { error: "Could not load usage." },
      { status: 500 },
    );
  }

  const total = (data ?? []).reduce(
    (acc, row) => acc + (row.estimated_cost_gbp ?? 0),
    0,
  );
  const alerted = total > DAILY_LIMIT_GBP;

  if (alerted) {
    try {
      await sendCostAlert(ownerEmail, total, DAILY_LIMIT_GBP);
    } catch (err) {
      console.error("[cron/teaser-cost-alert] alert send threw", err);
      return NextResponse.json(
        { total, limit: DAILY_LIMIT_GBP, alerted: false },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    total,
    limit: DAILY_LIMIT_GBP,
    alerted,
  });
}
