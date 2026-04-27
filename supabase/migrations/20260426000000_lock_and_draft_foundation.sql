-- ============================================================
-- Lock and draft backend foundation
-- ============================================================

alter table profiles add column if not exists trial_started_at timestamptz;
alter table profiles add column if not exists stripe_subscription_status text;
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists current_period_end timestamptz;
alter table profiles add column if not exists trial_generations_used integer not null default 0;
alter table profiles add column if not exists trial_refreshes_used integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_stripe_subscription_status_check'
  ) then
    alter table profiles add constraint profiles_stripe_subscription_status_check
      check (
        stripe_subscription_status is null
        or stripe_subscription_status in ('active', 'past_due', 'canceled', 'incomplete')
      );
  end if;
end $$;

alter table trips add column if not exists ai_generations_count integer not null default 0;
alter table trips add column if not exists last_price_refresh_at timestamptz;
alter table trips add column if not exists last_price_refresh_by uuid references profiles(id);
alter table trips add column if not exists enriched_draft jsonb;
alter table trips add column if not exists enriched_draft_generated_at timestamptz;
alter table trips add column if not exists enriched_draft_tier text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_enriched_draft_tier_check'
  ) then
    alter table trips add constraint trips_enriched_draft_tier_check
      check (
        enriched_draft_tier is null
        or enriched_draft_tier in ('basic', 'enriched')
      );
  end if;
end $$;

create table if not exists places_cache (
  cache_key text primary key,
  endpoint text not null,
  response_data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists places_cache_expires_at_idx on places_cache(expires_at);

alter table places_cache enable row level security;

alter table ai_usage add column if not exists feature text;
alter table ai_usage add column if not exists estimated_cost_gbp numeric(10, 4) not null default 0;
alter table ai_usage add column if not exists succeeded boolean not null default true;
alter table ai_usage add column if not exists error_message text;
alter table ai_usage add column if not exists duration_ms integer;
alter table ai_usage add column if not exists places_calls integer not null default 0;

update ai_usage
set feature = case
  when operation = 'price_refresh' then 'price_refresh'
  else 'lock_and_draft_enriched'
end
where feature is null;

alter table ai_usage alter column feature set default 'lock_and_draft_enriched';
alter table ai_usage alter column feature set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_usage_feature_check'
  ) then
    alter table ai_usage add constraint ai_usage_feature_check
      check (feature in ('lock_and_draft_basic', 'lock_and_draft_enriched', 'price_refresh'));
  end if;
end $$;

create index if not exists ai_usage_user_id_idx on ai_usage(user_id);
create index if not exists ai_usage_trip_id_idx on ai_usage(trip_id);
create index if not exists ai_usage_created_at_idx on ai_usage(created_at);

create or replace function get_user_plan(p_user_id uuid) returns text as $$
declare
  p profiles%rowtype;
begin
  select * into p from profiles where id = p_user_id;

  if p is null then
    return 'free';
  end if;

  if p.stripe_subscription_status = 'active' then
    return 'pro';
  end if;

  if p.trial_started_at is not null
     and p.trial_started_at > now() - interval '7 days' then
    return 'trial';
  end if;

  return 'free';
end;
$$ language plpgsql stable security definer;

create or replace function increment_generation_counters(
  p_user_id uuid,
  p_trip_id uuid,
  p_is_trial boolean
) returns void as $$
begin
  update trips
  set ai_generations_count = coalesce(ai_generations_count, 0) + 1
  where id = p_trip_id;

  if p_is_trial then
    update profiles
    set trial_generations_used = coalesce(trial_generations_used, 0) + 1
    where id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function refund_generation_counters(
  p_user_id uuid,
  p_trip_id uuid,
  p_is_trial boolean
) returns void as $$
begin
  update trips
  set ai_generations_count = greatest(coalesce(ai_generations_count, 0) - 1, 0)
  where id = p_trip_id;

  if p_is_trial then
    update profiles
    set trial_generations_used = greatest(coalesce(trial_generations_used, 0) - 1, 0)
    where id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function record_price_refresh(
  p_user_id uuid,
  p_trip_id uuid,
  p_is_trial boolean
) returns void as $$
begin
  update trips
  set last_price_refresh_at = now(),
      last_price_refresh_by = p_user_id
  where id = p_trip_id;

  if p_is_trial then
    update profiles
    set trial_refreshes_used = coalesce(trial_refreshes_used, 0) + 1
    where id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function cleanup_expired_places_cache() returns void as $$
begin
  delete from places_cache where expires_at < now();
end;
$$ language plpgsql security definer;
