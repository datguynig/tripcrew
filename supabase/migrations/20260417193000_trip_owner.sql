-- ============================================================
-- trip_owner
-- Single-owner concept for trips, separate from trip_members.role.
-- Admins (per trip_members.role='admin') continue to manage
-- destinations/bookings/etc. The owner is the one person who sees the
-- /admin settings surface and controls metadata, dates, and lifecycle.
-- Seeded from created_by for all existing trips.
-- ============================================================

alter table trips
  add column if not exists owner_id uuid references profiles(id) on delete set null;

-- Seed existing rows: creator becomes owner. created_by was stamped at
-- trip creation (see multi_trip_pivot's trips_insert_authed policy).
update trips set owner_id = created_by where owner_id is null;

-- Allow the owner to update their own trip. The existing
-- trips_update_if_admin policy stays; owner-only is additive.
drop policy if exists "trips_update_if_owner" on trips;
create policy "trips_update_if_owner" on trips
  for update to authenticated using (owner_id = auth.uid());
