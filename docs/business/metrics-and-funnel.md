# Metrics And Funnel Definitions

Last updated: 2026-04-28

This doc defines the business metrics Yenkoh should review during invite-only launch. Prefer SQL-backed definitions from Supabase until volume justifies a dedicated analytics tool.

## North Star

Primary activation metric:

**A crew locks a destination and generates or accepts a useful shared plan.**

The practical proxy is:

- Trip created.
- At least two members.
- At least two destination candidates or one curated lead-created trip.
- Destination locked.
- Overview viewed after lock.
- Paid trips: Lock & Draft generated successfully.

## Funnel Stages

| Stage | Definition | Source |
| --- | --- | --- |
| Visitor | Anonymous user reaches public landing or curated route | Web analytics / server logs |
| Lead | Email captured on landing, application, or curated teaser | `applications`, `draft_leads` |
| Qualified application | Application submitted with enough answers to score | `applications` |
| Approved | Founder/admin approves or auto-approval succeeds | `applications.status` |
| Checkout started | Stripe Checkout session created | Stripe logs / action logs |
| Paid | Stripe subscription created and webhook updates profile | `profiles.stripe_subscription_status`, `applications.first_paid_at` |
| Activated user | User creates or joins a trip and reaches the core loop | `trips`, `trip_members` |
| Activated trip | Trip locks a destination | `trips.status = locked` |
| AI activated trip | Paid trip has successful enriched draft | `trips.enriched_draft_generated_at`, `ai_usage` |

## Launch Dashboard Questions

Review daily:

- How many applications were submitted?
- How many were approved, held, or rejected?
- How many approved users started checkout?
- How many paid?
- How many paid users created a trip?
- How many trips invited at least one other member?
- How many trips locked a destination?
- How many paid trips generated an AI draft?
- What was average AI cost per successful paid draft?

## Activation Cohorts

Useful cohort slices:

- Applicant role: organiser, member, depends.
- Trip frequency: 0, 1, 2-3, 4+ trips per year.
- Pain: dates, booking inertia, money awkwardness, plan never made, chaos.
- Budget attitude: splurge, careful, monopoly money, depends.
- Entry path: landing, invite, curated trip.
- Plan: Free, Member, Pioneer.

## Suggested SQL Checks

These are starting points. Adjust column names if migrations evolve.

```sql
-- Application volume by day
select date_trunc('day', created_at) as day, count(*) as applications
from applications
group by 1
order by 1 desc;
```

```sql
-- Application status mix
select status, count(*)
from applications
group by status
order by count(*) desc;
```

```sql
-- Paid conversion from application rows
select
  count(*) filter (where first_paid_at is not null) as paid,
  count(*) as total,
  round(100.0 * count(*) filter (where first_paid_at is not null) / nullif(count(*), 0), 2) as paid_pct
from applications;
```

```sql
-- Locked trips and AI-drafted trips
select
  count(*) filter (where status = 'locked') as locked_trips,
  count(*) filter (where enriched_draft_generated_at is not null) as ai_drafted_trips
from trips;
```

```sql
-- AI usage cost by day
select
  date_trunc('day', created_at) as day,
  count(*) as runs,
  sum(total_cost_usd) as total_cost_usd
from ai_usage
group by 1
order by 1 desc;
```

## Decision Thresholds

Use these as review prompts, not hard rules:

- If landing-to-application conversion is low, the page is not proving the product quickly enough.
- If application-to-paid conversion is low, pricing, wait time, or approval copy is creating friction.
- If paid-to-first-trip is low, onboarding is failing after checkout.
- If trip-created-to-destination-locked is low, group setup or destination voting is too slow.
- If AI draft success is low, paid value is at risk.
- If cost per successful draft rises sharply, inspect Places calls, model output retries, and draft quality.

## Instrumentation Gaps

- Public web analytics are not yet a canonical source in this repo.
- Checkout-started is easiest to inspect in Stripe until app-side event logging exists.
- Curated teaser conversion needs a joined view across `draft_leads`, `applications`, Stripe, and first trip creation.
- PMF survey and churn reasons are not implemented yet.
