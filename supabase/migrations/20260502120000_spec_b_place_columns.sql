-- Spec B: structured place fields on bookings and activities so links
-- always resolve to verified Google Places destinations.

alter table bookings
  add column if not exists place_id text,
  add column if not exists maps_url text,
  add column if not exists website_url text,
  add column if not exists custom_url text;

alter table activities
  add column if not exists place_id text,
  add column if not exists maps_url text;

comment on column bookings.place_id is 'Google Places place_id, set at Lock & Draft time. Null for manual additions or unresolved AI suggestions.';
comment on column bookings.custom_url is 'Admin-only override; takes precedence over maps_url/website_url when set.';
comment on column activities.place_id is 'Google Places place_id, set during AI draft. Null for manual additions or unresolved.';
