-- 20260429000000_applications_table.sql
-- Captures the qualified-application gate: visitor email + Q1-Q4 answers,
-- approval lifecycle, conversion attribution. RLS denies all access by
-- default; only the service role (server actions) and founder admin
-- writes/reads.

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),

  trips_per_year text not null check (trips_per_year in ('0','1','2-3','4+')),
  role text not null check (role in ('organiser','attendee','depends')),
  pain text not null check (pain in ('dates','booking','money','plan','chaos')),
  budget_attitude text not null check (budget_attitude in ('monopoly','splurge','count','depends')),

  approved_at timestamptz,
  approved_by uuid references profiles(id) on delete set null,
  invite_token text unique,
  invite_sent_at timestamptz,
  user_id uuid references profiles(id) on delete set null,
  activated_at timestamptz,
  first_trip_at timestamptz,
  first_lock_at timestamptz,
  first_paid_at timestamptz,

  utm_source text,
  utm_campaign text,
  referrer text
);

create index applications_user_id_idx on applications(user_id);
create index applications_pending_idx on applications(approved_at) where user_id is null and approved_at is null;
create index applications_invite_token_idx on applications(invite_token) where invite_token is not null;

alter table applications enable row level security;

-- Anonymous applicants can insert their own row. Read-back is denied
-- (the action returns the id directly to avoid exposing other rows).
create policy "applications_insert_anon" on applications
  for insert
  to anon, authenticated
  with check (true);
