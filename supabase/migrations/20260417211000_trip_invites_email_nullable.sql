-- H-b: email becomes optional. Copy-link invites don't require an email
-- up front; email is now metadata for "I sent this to alice@…" labeling,
-- not a primary key component.
--
-- The (trip_id, email) unique constraint stays — Postgres treats NULLs
-- as distinct, so multiple link-only invites per trip coexist fine.

alter table trip_invites
  alter column email drop not null;
