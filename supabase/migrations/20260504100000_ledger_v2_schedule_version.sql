-- supabase/migrations/20260504100000_ledger_v2_schedule_version.sql
-- Ledger v2 Phase 2 · expense schedule

alter table expenses
  add column if not exists schedule jsonb null;

-- Validate the schedule shape via a CHECK. CHECK can't run JS, but we
-- can require schedule.type to be one of three strings if present.
alter table expenses
  drop constraint if exists expenses_schedule_type_check;
alter table expenses
  add constraint expenses_schedule_type_check
  check (
    schedule is null
    or (schedule ->> 'type') in ('none', 'single', 'installments')
  );
