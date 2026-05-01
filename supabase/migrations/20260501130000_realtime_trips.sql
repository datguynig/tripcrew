-- Add trips to the supabase_realtime publication so the overview can
-- auto-refresh when generateLockAndDraft completes via after().

do $$
begin
  perform 1
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'trips';
  if not found then
    execute 'alter publication supabase_realtime add table trips';
  end if;
end $$;
