import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      // Auto-finalises Cohort 01 applications past their 24-hour review
      // window. Daily at 09:00 UTC (Hobby-tier limit). Means an application
      // submitted at 09:01 UTC waits up to ~48h for auto-finalise (24h SLA
      // + 24h cron gap) — acceptable for v1; tighten by upgrading Vercel
      // to Pro and changing this back to */15.
      path: "/api/cron/finalise-applications",
      schedule: "0 9 * * *",
    },
    {
      // Day-7 nudge for draft_leads that captured a teaser but never
      // applied. Daily at 10:00 UTC. Hourly precision doesn't matter for
      // a 7-day-out drip — once-per-day fits Hobby tier.
      path: "/api/cron/teaser-day-7-nudge",
      schedule: "0 10 * * *",
    },
    {
      // Cost-ceiling alarm for the curated-teaser AI flow. Daily at 11:00
      // UTC. £40/24h is a sustained-burst alert, not a real-time circuit
      // breaker, so daily is fine.
      path: "/api/cron/teaser-cost-alert",
      schedule: "0 11 * * *",
    },
  ],
};
