-- ============================================================
-- Multi-trip pivot
-- Adds status/destination/vote_deadline/created_by/meta to trips,
-- adds role/invited_by to trip_members, introduces destination_candidates,
-- destination_votes, and trip_invites tables.
-- Wipes all existing trip-level data (Stockholm seed + test users' data).
-- Profiles and auth.users are untouched.
-- ============================================================

create extension if not exists "citext";

-- ---------- trips ----------

alter table trips
  add column if not exists status text not null default 'planning',
  add column if not exists destination text,
  add column if not exists vote_deadline timestamptz,
  add column if not exists created_by uuid references profiles(id) on delete set null,
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table trips drop constraint if exists trips_status_check;
alter table trips add constraint trips_status_check check (status in ('planning', 'locked'));

alter table trips alter column start_date drop not null;
alter table trips alter column end_date drop not null;
alter table trips alter column target_crew_size drop not null;

-- ---------- trip_members ----------

alter table trip_members
  add column if not exists role text not null default 'member',
  add column if not exists invited_by uuid references profiles(id) on delete set null;

alter table trip_members drop constraint if exists trip_members_role_check;
alter table trip_members add constraint trip_members_role_check check (role in ('admin', 'member'));

-- Helper: is current user an admin of a trip?
create or replace function is_trip_admin(trip uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from trip_members
    where trip_id = trip and user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- destination_candidates ----------

create table if not exists destination_candidates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  note text check (note is null or length(note) <= 280),
  proposed_by uuid references profiles(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists destination_candidates_trip_id_idx on destination_candidates(trip_id);

alter table destination_candidates enable row level security;

create policy "dest_candidates_read_if_member" on destination_candidates
  for select to authenticated using (is_trip_member(trip_id));

create policy "dest_candidates_insert_if_member" on destination_candidates
  for insert to authenticated with check (
    proposed_by = auth.uid() and is_trip_member(trip_id)
  );

create policy "dest_candidates_update_if_admin" on destination_candidates
  for update to authenticated using (is_trip_admin(trip_id));

create policy "dest_candidates_delete_if_proposer_or_admin" on destination_candidates
  for delete to authenticated using (
    proposed_by = auth.uid() or is_trip_admin(trip_id)
  );

-- ---------- destination_votes ----------

create table if not exists destination_votes (
  candidate_id uuid not null references destination_candidates(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (candidate_id, user_id)
);

create index if not exists destination_votes_candidate_id_idx on destination_votes(candidate_id);

alter table destination_votes enable row level security;

create policy "dest_votes_read_if_trip_member" on destination_votes
  for select to authenticated using (
    is_trip_member((select trip_id from destination_candidates where id = candidate_id))
  );

create policy "dest_votes_insert_self" on destination_votes
  for insert to authenticated with check (user_id = auth.uid());

create policy "dest_votes_update_self" on destination_votes
  for update to authenticated using (user_id = auth.uid());

create policy "dest_votes_delete_self" on destination_votes
  for delete to authenticated using (user_id = auth.uid());

-- ---------- trip_invites ----------

create table if not exists trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  email citext not null,
  invited_by uuid references profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (trip_id, email)
);

create index if not exists trip_invites_email_idx on trip_invites(email) where accepted_at is null;

alter table trip_invites enable row level security;

-- Admin of the trip can see pending invites.
create policy "trip_invites_read_if_admin" on trip_invites
  for select to authenticated using (is_trip_admin(trip_id));

create policy "trip_invites_insert_if_admin" on trip_invites
  for insert to authenticated with check (
    invited_by = auth.uid() and is_trip_admin(trip_id)
  );

create policy "trip_invites_delete_if_admin" on trip_invites
  for delete to authenticated using (is_trip_admin(trip_id));

-- ---------- Updated policies on existing tables ----------

-- trips: authed users can create (they become admin via service-role bootstrap in server action),
-- admin can update/delete. Read stays open to authenticated.
drop policy if exists "trips_insert_authed" on trips;
create policy "trips_insert_authed" on trips
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "trips_update_if_admin" on trips;
create policy "trips_update_if_admin" on trips
  for update to authenticated using (is_trip_admin(id));

drop policy if exists "trips_delete_if_admin" on trips;
create policy "trips_delete_if_admin" on trips
  for delete to authenticated using (is_trip_admin(id));

-- trip_members: drop blanket self-insert (bootstrap + invite acceptance go via service role).
-- Members may leave themselves; admins manage others.
drop policy if exists "members_insert_self" on trip_members;

drop policy if exists "members_update_if_admin" on trip_members;
create policy "members_update_if_admin" on trip_members
  for update to authenticated using (is_trip_admin(trip_id));

drop policy if exists "members_delete_self_or_admin" on trip_members;
create policy "members_delete_self_or_admin" on trip_members
  for delete to authenticated using (
    user_id = auth.uid() or is_trip_admin(trip_id)
  );

-- activities: admin can manage; read stays member-gated.
drop policy if exists "activities_insert_if_admin" on activities;
create policy "activities_insert_if_admin" on activities
  for insert to authenticated with check (is_trip_admin(trip_id));

drop policy if exists "activities_update_if_admin" on activities;
create policy "activities_update_if_admin" on activities
  for update to authenticated using (is_trip_admin(trip_id));

drop policy if exists "activities_delete_if_admin" on activities;
create policy "activities_delete_if_admin" on activities
  for delete to authenticated using (is_trip_admin(trip_id));

-- ---------- Realtime ----------

alter publication supabase_realtime add table destination_candidates;
alter publication supabase_realtime add table destination_votes;

-- ---------- Wipe existing trip-level data ----------
-- Cascades through trip_members, activities, votes, bookings, expenses, posts,
-- destination_candidates, destination_votes, trip_invites.
truncate table trips cascade;
