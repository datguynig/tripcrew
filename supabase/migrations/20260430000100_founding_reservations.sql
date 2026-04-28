-- 20260430000100_founding_reservations.sql
-- Atomic 500-seat reservation for the Founding tier.
-- Each row is either an active hold (consumed=false, expires_at > now())
-- or a consumed seat (consumed=true). Aggregating both gives the total
-- "claimed" count, capped at 500 by reserve_founding_seat().

create table if not exists founding_reservations (
  id uuid primary key default gen_random_uuid(),
  draft_lead_id uuid references draft_leads(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create index founding_reservations_active_idx on founding_reservations (expires_at)
  where consumed = false;
create index founding_reservations_session_idx on founding_reservations (stripe_session_id)
  where stripe_session_id is not null;

alter table founding_reservations enable row level security;
-- No policies. Service-role only — every read/write goes through the
-- API layer which already validates ownership.

create or replace function reserve_founding_seat(p_draft_lead_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_held integer;
  v_reservation_id uuid;
begin
  -- Serialise concurrent claimants on the 500-seat boundary. The
  -- advisory lock is transaction-scoped so it releases on commit/rollback.
  perform pg_advisory_xact_lock(hashtext('founding_reservation'));

  select count(*) into v_held
  from founding_reservations
  where consumed = true
     or (consumed = false and expires_at > now());

  if v_held >= 500 then
    return null;
  end if;

  insert into founding_reservations (draft_lead_id, expires_at)
  values (p_draft_lead_id, now() + interval '15 minutes')
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

revoke all on function reserve_founding_seat(uuid) from public, anon, authenticated;
