-- H-a: extend trip_invites for copy-link invite flow.
-- token: random 256-bit secret, app-generated on insert, unique.
-- expires_at: hard expiration; join route rejects expired rows.
-- accepted_by: fk to the profile that accepted; nullable until acceptance.
--
-- RLS stays tight: existing admin-only read/insert/delete policies already
-- gate normal queries. The /join/[token] server route will use the service
-- client (RLS bypass) to look up and consume invites by token, since the
-- token itself is the capability.

alter table trip_invites
  add column if not exists token text unique,
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_by uuid references profiles(id) on delete set null;

-- fast lookup on the acceptance path
create index if not exists idx_trip_invites_token on trip_invites(token);
