-- 20260429000300_sample_trip_seed.sql
-- Seeds the public Lisbon sample trip. /sample-trip/lisbon renders this row
-- via the TripPreview component without needing crew membership. Idempotent
-- via on conflict so re-running the migration won't error.
--
-- The row carries no `created_by` and no trip_members — it lives outside the
-- normal crew model and is only readable by the public sample-trip route
-- (which uses the service-role client).

insert into trips (
  slug,
  name,
  status,
  hero_title,
  hero_subtitle,
  city_label,
  dates_label,
  target_budget_pp,
  target_crew_size,
  currency,
  meta
) values (
  'lisbon',
  'Lisbon sample trip',
  'locked',
  'Lisbon',
  'Six friends. Six days. June.',
  'Lisbon',
  'Jun 14 — Jun 19',
  820,
  6,
  'GBP',
  jsonb_build_object(
    'is_sample', true,
    'origin', 'LHR',
    'vibes', 'Foodie · Wine'
  )
)
on conflict (slug) do update set
  name = excluded.name,
  hero_title = excluded.hero_title,
  hero_subtitle = excluded.hero_subtitle,
  city_label = excluded.city_label,
  dates_label = excluded.dates_label,
  target_budget_pp = excluded.target_budget_pp,
  target_crew_size = excluded.target_crew_size,
  currency = excluded.currency,
  meta = excluded.meta;
