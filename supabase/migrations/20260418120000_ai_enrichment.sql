-- ============================================================
-- AI enrichment — "Lock & draft" beta
--
-- Adds the infrastructure for paid-tier AI drafting:
--   1. Per-user gate (profiles.ai_enabled)
--   2. Draft markers on trips / activities / bookings so the UI
--      can render a subtle "AI" badge on drafted rows
--   3. ai_usage telemetry so the owner can watch spend per user
--      and per trip during the closed beta
--   4. ai_feedback collector so users can rate drafts (up/down + note)
--
-- Additive + idempotent. No destructive ops.
-- ============================================================

-- 1. Per-user beta gate. Flipped manually in Supabase Studio during
-- the closed beta; read on every trip page request to decide whether
-- the AIDraftCTA renders.
alter table profiles
  add column if not exists ai_enabled boolean not null default false;

-- 2. Trip-level draft marker. Null = never drafted. Used by the
-- UI to hide the "Draft this trip with AI" CTA once a pass has run.
alter table trips
  add column if not exists ai_drafted_at timestamptz;

-- Row-level draft markers. Flipped on insert when the AI pass
-- creates the row. Rendering: subtle mono "AI" chip inline.
alter table activities
  add column if not exists ai_drafted boolean not null default false;

alter table bookings
  add column if not exists ai_drafted boolean not null default false;

-- 3. ai_usage — cost telemetry. Written by the server action after
-- every successful draft. Read only by the owner via the private
-- /ai-usage dashboard.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  trip_id uuid references trips(id) on delete cascade,
  operation text not null,
  provider text not null default 'gemini',
  model text,
  input_tokens integer,
  output_tokens integer,
  thinking_tokens integer,
  ai_cost_usd numeric(10, 4),
  places_requests integer,
  places_cost_usd numeric(10, 4),
  total_cost_usd numeric(10, 4),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_trip
  on ai_usage(trip_id, created_at desc);

create index if not exists idx_ai_usage_user
  on ai_usage(user_id, created_at desc);

alter table ai_usage enable row level security;

-- Trip admins can see usage for their trip. Inserts are done via
-- the server action using the service role, so no insert policy
-- needed for authenticated clients.
drop policy if exists "ai_usage_read_trip_admin" on ai_usage;
create policy "ai_usage_read_trip_admin" on ai_usage
  for select to authenticated using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = ai_usage.trip_id
        and trip_members.user_id = auth.uid()
        and trip_members.role = 'admin'
    )
  );

-- 4. ai_feedback — captured from the per-section thumbs up/down card
-- below AI-drafted sections. Used to tune prompts between beta weeks.
create table if not exists ai_feedback (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  surface text not null check (
    surface in ('schedule', 'hero_spec', 'activities', 'bookings', 'all')
  ),
  rating smallint check (rating in (-1, 1)),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_feedback_trip
  on ai_feedback(trip_id, created_at desc);

alter table ai_feedback enable row level security;

-- Members of a trip can read all feedback on that trip (helps the
-- crew see signal) and insert their own.
drop policy if exists "ai_feedback_read_if_member" on ai_feedback;
create policy "ai_feedback_read_if_member" on ai_feedback
  for select to authenticated using (is_trip_member(trip_id));

drop policy if exists "ai_feedback_insert_self" on ai_feedback;
create policy "ai_feedback_insert_self" on ai_feedback
  for insert to authenticated with check (
    user_id = auth.uid() and is_trip_member(trip_id)
  );
