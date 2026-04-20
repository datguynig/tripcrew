-- Drop owner_id from trips. Admin gate is is_trip_admin() (trip_members.role='admin')
-- across all RLS policies and server helpers. owner_id was a redundant second
-- source of truth; removing it keeps the invariant single.

drop policy if exists "trips_update_if_owner" on trips;
alter table trips drop column if exists owner_id;
