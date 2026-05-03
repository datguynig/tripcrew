-- supabase/migrations/20260504100400_ledger_v2_realtime_payment_tables.sql
-- Ledger v2 Phase 2 · realtime for payback schedule mutations.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payment_obligations'
  ) then
    execute 'alter publication supabase_realtime add table payment_obligations';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    execute 'alter publication supabase_realtime add table payments';
  end if;
end $$;
