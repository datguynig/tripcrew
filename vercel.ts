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
  ],
};
