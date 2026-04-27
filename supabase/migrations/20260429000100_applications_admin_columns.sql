-- 20260429000100_applications_admin_columns.sql
-- Admin triage adds: rejected_at/rejected_by audit columns, free-text notes
-- so the founder can scribble context, and a global is_founder flag on
-- profiles to gate /admin/applications/* routes (separate from per-trip
-- admin role on trip_members).

alter table applications add column rejected_at timestamptz;
alter table applications add column rejected_by uuid references profiles(id) on delete set null;
alter table applications add column admin_notes text;

alter table profiles add column is_founder boolean not null default false;

create index applications_rejected_at_idx on applications(rejected_at) where rejected_at is not null;

-- Founder reads. Service-role bypasses RLS for server actions; this policy
-- supports anything the founder reads via their own session (e.g. the
-- analytics dashboard if we ever switch off service role for it).
create policy "applications_founder_read" on applications
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.is_founder = true
    )
  );

create policy "applications_founder_update" on applications
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.is_founder = true
    )
  );
