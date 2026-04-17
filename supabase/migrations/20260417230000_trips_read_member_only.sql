-- ============================================================
-- Tighten trip read visibility.
--
-- Previously `trips_read_all` let any signed-in user read every trip's
-- metadata (name, destination, schedule, spec grid, section leads,
-- budget). With multi-trip in production, that's a data leak —
-- anyone with an account could scrape the full trip directory.
--
-- New policy scopes SELECT to members only. Knock-on checks:
--
-- - `getUserTrips` embeds trips via `trip_members!inner` — the user
--   *is* a member so rows pass.
-- - `/join/[token]` uses the service client (RLS bypass) to resolve
--   invites, unaffected.
-- - `/trips/new` creates trips via the service client, unaffected.
-- - Non-members hitting /trips/[slug] now see `getTrip()` return null,
--   which the page treats as notFound — correct behaviour.
-- ============================================================

drop policy if exists "trips_read_all" on trips;

create policy "trips_read_if_member" on trips
  for select to authenticated using (is_trip_member(id));
