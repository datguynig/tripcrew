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
    // Phase 4 will add the day-7 nudge cron here.
  ],
};
