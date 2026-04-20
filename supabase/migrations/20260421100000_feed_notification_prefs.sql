-- Per-(user, trip) notification preferences. Currently one column
-- (feed_muted) that skips a user out of the feed_message fan-out in
-- addPost. Non-destructive: absence of a row === defaults, so this
-- table can roll out without backfilling anything.

create table if not exists trip_notification_prefs (
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  feed_muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_notification_prefs_user_id_idx
  on trip_notification_prefs(user_id);

alter table trip_notification_prefs enable row level security;

create policy "trip_notification_prefs_read_own" on trip_notification_prefs
  for select to authenticated using (user_id = auth.uid());

create policy "trip_notification_prefs_upsert_own" on trip_notification_prefs
  for insert to authenticated with check (user_id = auth.uid());

create policy "trip_notification_prefs_update_own" on trip_notification_prefs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$ begin
  perform 1
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'trip_notification_prefs';
  if not found then
    execute 'alter publication supabase_realtime add table trip_notification_prefs';
  end if;
end $$;
