-- supabase/migrations/20260503100000_ledger_v2_extend_expenses.sql
-- Ledger v2 Phase 1 · extend expenses with FX provenance, version, soft-delete

alter table expenses
  add column if not exists original_currency text null,
  add column if not exists original_amount numeric(12, 2) null,
  add column if not exists fx_rate numeric(12, 6) null,
  add column if not exists fx_rate_source text null
    check (fx_rate_source is null or fx_rate_source in ('frankfurter', 'manual')),
  add column if not exists fx_rate_date date null,
  add column if not exists fx_suggested_amount numeric(12, 2) null,
  add column if not exists fx_user_overridden boolean not null default false,
  add column if not exists version int not null default 1,
  add column if not exists deleted_at timestamptz null;

-- Bump amount precision to match the new tables (12, 2). Existing rows
-- keep their values; the column type widens.
alter table expenses
  alter column amount type numeric(12, 2);

-- Hide soft-deleted rows from the existing index path used by the
-- realtime feed and the ledger page query.
create index if not exists expenses_trip_active_idx
  on expenses (trip_id, created_at desc)
  where deleted_at is null;
