import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      // Auto-finalises Cohort 01 applications past their 24-hour review
      // window. Every 15 minutes is fine — the cron is idempotent (the
      // UPDATE filters on decision_finalised_at IS NULL) and a slightly
      // delayed finalisation is preferable to a too-early one.
      path: "/api/cron/finalise-applications",
      schedule: "*/15 * * * *",
    },
    {
      // Day-7 nudge for draft_leads that captured a teaser but never
      // applied. Hourly cadence — the eligibility filter (created_at older
      // than 7 days, no nudge_sent_at, no unsubscribed_at, no application)
      // means most runs do nothing; we only want a small lag from the 7-day
      // boundary to first send.
      path: "/api/cron/teaser-day-7-nudge",
      schedule: "0 * * * *",
    },
    {
      // Cost-ceiling alarm for the curated-teaser AI flow. Sums
      // ai_usage.estimated_cost_gbp over the last 24h; if total > £40 it
      // emails AI_BETA_OWNER_EMAIL. Every 6 hours is enough — the alarm
      // fires off a sustained burst, not a single rogue request.
      path: "/api/cron/teaser-cost-alert",
      schedule: "0 */6 * * *",
    },
  ],
};
