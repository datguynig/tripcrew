-- ============================================================
-- Stockholm Boys Trip · Initial Supabase Schema
-- Run this in the Supabase SQL editor after creating a project.
-- Then run scripts/seed.ts to populate the trip and activities.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Tables ----------

-- Display profile per auth user.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  joined_at timestamptz not null default now()
);

-- Trips. MVP uses one, but schema supports many.
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  start_date date,
  end_date date,
  target_crew_size int not null default 5,
  created_at timestamptz not null default now()
);

-- Trip membership.
create table if not exists trip_members (
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Activities (shortlist items). Seeded per trip.
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null,
  meta text,
  category text not null check (category in ('day', 'night')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists activities_trip_id_idx on activities(trip_id);

-- Votes. Upsert on conflict, delete to clear.
create table if not exists votes (
  activity_id uuid not null references activities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  vote text not null check (vote in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

-- Bookings. Communal, any member can edit.
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  assignee_id uuid references profiles(id) on delete set null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

create index if not exists bookings_trip_id_idx on bookings(trip_id);

-- Expenses. Pooled and split evenly.
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  description text not null check (length(description) between 1 and 200),
  amount numeric(10, 2) not null check (amount > 0),
  paid_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists expenses_trip_id_idx on expenses(trip_id);

-- Feed posts.
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  image_url text,
  caption text check (caption is null or length(caption) <= 500),
  author_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (image_url is not null or caption is not null)
);

create index if not exists posts_trip_id_idx on posts(trip_id);

-- ---------- RLS ----------

alter table profiles enable row level security;
alter table trips enable row level security;
alter table trip_members enable row level security;
alter table activities enable row level security;
alter table votes enable row level security;
alter table bookings enable row level security;
alter table expenses enable row level security;
alter table posts enable row level security;

-- Helper: check if current user is a member of a trip.
create or replace function is_trip_member(trip uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from trip_members
    where trip_id = trip and user_id = auth.uid()
  );
$$;

-- Profiles: anyone authenticated can read, users can manage their own row.
create policy "profiles_read_all" on profiles
  for select to authenticated using (true);

create policy "profiles_insert_self" on profiles
  for insert to authenticated with check (id = auth.uid());

create policy "profiles_update_self" on profiles
  for update to authenticated using (id = auth.uid());

-- Trips: authenticated users can read. No client-side writes.
create policy "trips_read_all" on trips
  for select to authenticated using (true);

-- Trip members: members can see the roster. Users add themselves.
create policy "members_read_if_member" on trip_members
  for select to authenticated using (is_trip_member(trip_id));

create policy "members_insert_self" on trip_members
  for insert to authenticated with check (user_id = auth.uid());

-- Activities: members can read. No client-side writes in MVP.
create policy "activities_read_if_member" on activities
  for select to authenticated using (is_trip_member(trip_id));

-- Votes: members can read all, users manage their own votes.
create policy "votes_read_if_trip_member" on votes
  for select to authenticated using (
    is_trip_member((select trip_id from activities where id = activity_id))
  );

create policy "votes_insert_self" on votes
  for insert to authenticated with check (user_id = auth.uid());

create policy "votes_update_self" on votes
  for update to authenticated using (user_id = auth.uid());

create policy "votes_delete_self" on votes
  for delete to authenticated using (user_id = auth.uid());

-- Bookings: members can read and write all bookings for their trip.
create policy "bookings_read_if_member" on bookings
  for select to authenticated using (is_trip_member(trip_id));

create policy "bookings_insert_if_member" on bookings
  for insert to authenticated with check (is_trip_member(trip_id));

create policy "bookings_update_if_member" on bookings
  for update to authenticated using (is_trip_member(trip_id));

create policy "bookings_delete_if_member" on bookings
  for delete to authenticated using (is_trip_member(trip_id));

-- Expenses: members can read all, but only the payer can modify or delete.
create policy "expenses_read_if_member" on expenses
  for select to authenticated using (is_trip_member(trip_id));

create policy "expenses_insert_self" on expenses
  for insert to authenticated with check (
    paid_by = auth.uid() and is_trip_member(trip_id)
  );

create policy "expenses_update_payer" on expenses
  for update to authenticated using (paid_by = auth.uid());

create policy "expenses_delete_payer" on expenses
  for delete to authenticated using (paid_by = auth.uid());

-- Posts: members can read all, only author can modify or delete.
create policy "posts_read_if_member" on posts
  for select to authenticated using (is_trip_member(trip_id));

create policy "posts_insert_self" on posts
  for insert to authenticated with check (
    author_id = auth.uid() and is_trip_member(trip_id)
  );

create policy "posts_update_author" on posts
  for update to authenticated using (author_id = auth.uid());

create policy "posts_delete_author" on posts
  for delete to authenticated using (author_id = auth.uid());

-- ---------- Realtime ----------

alter publication supabase_realtime add table trip_members;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table posts;

-- ---------- Seed: trip + activities ----------
-- Idempotent. Safe to run multiple times.

insert into trips (slug, name, start_date, end_date, target_crew_size)
values ('stockholm-2026', 'Boys Trip 001 · Stockholm', '2026-07-23', '2026-07-26', 5)
on conflict (slug) do nothing;

do $$
declare
  trip_uuid uuid;
begin
  select id into trip_uuid from trips where slug = 'stockholm-2026';

  insert into activities (trip_id, title, meta, category, position) values
    (trip_uuid, 'Archipelago kayak', 'FRI AM · HALF DAY · £80', 'day', 1),
    (trip_uuid, 'Rib boat tour', 'KAYAK ALT · FASTER · £90', 'day', 2),
    (trip_uuid, 'Vasa Museum', 'SAT · 90 MIN · £18', 'day', 3),
    (trip_uuid, 'Gröna Lund', 'AMUSEMENT + CONCERTS', 'day', 4),
    (trip_uuid, 'Fotografiska', 'PHOTO MUSEUM · 10AM–11PM', 'day', 5),
    (trip_uuid, 'Skinnarviksberget', 'CLIFF JUMPS · FREE', 'day', 6),
    (trip_uuid, 'Centralbadet', 'SAUNA + COLD PLUNGE · £30', 'day', 7),
    (trip_uuid, 'Fjäderholmarna ferry', 'ISLAND + SEAFOOD LUNCH', 'day', 8),
    (trip_uuid, 'Trädgården', 'OPEN-AIR CLUB · UNDER BRIDGE', 'night', 9),
    (trip_uuid, 'Berns', 'GRAND CLUB · SMART', 'night', 10),
    (trip_uuid, 'Spy Bar', 'STUREPLAN · STRICT DOOR', 'night', 11),
    (trip_uuid, 'Slakthuset', 'TECHNO · LATE', 'night', 12),
    (trip_uuid, 'Södra Teatern', 'BEER TERRACE · 1000 CAP', 'night', 13),
    (trip_uuid, 'Häktet', 'PRISON BAR · COURTYARD', 'night', 14),
    (trip_uuid, 'Tjoget', 'COCKTAILS · TOP 100', 'night', 15),
    (trip_uuid, 'Pharmarium', 'SPEAKEASY · GAMLA STAN', 'night', 16)
  on conflict do nothing;

  insert into bookings (trip_id, title, position) values
    (trip_uuid, 'Flights. LHR direct. SAS or BA.', 1),
    (trip_uuid, 'Airbnb. 3-bed, Södermalm.', 2),
    (trip_uuid, 'Kayak tour. stockholmadventures.com', 3),
    (trip_uuid, 'Meatballs for the People. Thu 20:30.', 4),
    (trip_uuid, 'Pelikan. Fri 19:30.', 5),
    (trip_uuid, 'Kagges. Sat 19:30.', 6),
    (trip_uuid, 'Vasa Museum. Sat 10:30.', 7),
    (trip_uuid, 'Fotografiska brunch. Sun 11:00.', 8),
    (trip_uuid, 'SL 72hr travel cards.', 9)
  on conflict do nothing;
end $$;
