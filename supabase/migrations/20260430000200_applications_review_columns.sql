-- 20260430000200_applications_review_columns.sql
-- Phase 3 of the curated-teaser warm-lead path. Adds the 24-hour review-
-- window columns that let the founder (or a cron) finalise an application
-- with a recorded provisional decision + finalisation timestamp/source.
--
-- Also links applications back to the originating draft_lead so the Crew
-- Plus checkout can pre-seed the user's first trip, mirroring the
-- founding-checkout flow (see 20260430000100_founding_reservations.sql).

alter table applications
  add column if not exists draft_lead_id uuid references draft_leads(id) on delete set null;

alter table applications
  add column if not exists provisional_decision text
    check (provisional_decision in ('approve','reject'));

alter table applications
  add column if not exists auto_decision_at timestamptz;

alter table applications
  add column if not exists decision_finalised_at timestamptz;

alter table applications
  add column if not exists decision_finalised_by text
    check (decision_finalised_by in ('admin','cron'));

-- rejected_at already exists from 20260429000100_applications_admin_columns.sql
-- but `add column if not exists` is a no-op here for safety on partial replays.
alter table applications
  add column if not exists rejected_at timestamptz;

create index if not exists applications_pending_decision_idx
  on applications(auto_decision_at)
  where auto_decision_at is not null and decision_finalised_at is null;

create index if not exists applications_draft_lead_idx
  on applications(draft_lead_id)
  where draft_lead_id is not null;
