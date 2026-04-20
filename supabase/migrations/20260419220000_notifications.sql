-- ============================================================
-- In-app notifications — topbar bell + unread badge.
--
-- One row per (user, event) pair. Fan-out happens in server
-- actions via createNotifications() with the service role
-- client; end users never insert directly.
--
-- `kind` is an open text column (not an enum) so adding a new
-- event doesn't require a migration. The union of valid values
-- is enforced in src/lib/types.ts.
-- ============================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  kind text not null,
  actor_id uuid references profiles(id) on delete set null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_recent_idx
  on notifications(user_id, created_at desc);

-- Partial index keeps the unread count query fast even when a
-- user accumulates thousands of read rows.
create index if not exists notifications_user_unread_idx
  on notifications(user_id, created_at desc)
  where read_at is null;

alter table notifications enable row level security;

drop policy if exists "notifications_read_own" on notifications;
create policy "notifications_read_own" on notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Allow publication for realtime. A no-op if already added.
do $$ begin
  perform 1
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'notifications';
  if not found then
    execute 'alter publication supabase_realtime add table notifications';
  end if;
end $$;
