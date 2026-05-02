-- Spec B follow-up: column comments for the Phase 1 fields that
-- 20260502120000_spec_b_place_columns.sql didn't include. Flagged in
-- code review of Task 1 as documentation polish; carried in a separate
-- migration so already-applied environments still get the comments.

comment on column bookings.maps_url is 'Google Maps URI from Places. Null until resolved at Lock & Draft time.';
comment on column bookings.website_url is 'Venue website URI from Places. Null when Places returned no websiteUri.';
comment on column activities.maps_url is 'Google Maps URI from Places, set during AI draft. Null for unresolved activities.';
