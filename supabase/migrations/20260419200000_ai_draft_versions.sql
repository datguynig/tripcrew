-- ============================================================
-- AI draft versions — rollback history for the redraft surfaces.
--
-- Before any redraft (section, row, or full trip) overwrites AI-
-- drafted content, we snapshot the pre-write state into this table.
-- Admins can then preview + restore one of the last 3 snapshots per
-- surface via a popover on the AIDraftRail.
--
-- Why not just keep old AI activities/bookings rows with a flag?
-- The spec_grid + schedule + hero fields are scalar columns on
-- trips — they don't have a natural per-version storage. Jsonb
-- snapshots keep every surface uniform.
-- ============================================================

create table if not exists ai_draft_versions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  surface text not null check (
    surface in ('spec_grid', 'schedule', 'activities', 'bookings', 'full')
  ),
  -- jsonb body. Shape depends on surface:
  --   spec_grid  → { spec_grid: SpecItem[] }
  --   schedule   → { schedule: ScheduleItem[] }
  --   activities → { activities: Array<{ title, meta, category, position }> }
  --   bookings   → { bookings: Array<{ title, position }> }
  --   full       → { hero_title, hero_subtitle, meta, activities, bookings }
  content jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  -- Short human-readable preview (first heading, first cell value,
  -- etc.) so the popover can show something before opening full content.
  preview text
);

create index if not exists idx_ai_draft_versions_trip_surface
  on ai_draft_versions(trip_id, surface, created_at desc);

alter table ai_draft_versions enable row level security;

-- Trip admins only. Reading is scoped to admins because the content
-- can include AI-generated copy that's awaiting review. Inserts all
-- happen via service role inside server actions.
drop policy if exists "ai_draft_versions_read_trip_admin" on ai_draft_versions;
create policy "ai_draft_versions_read_trip_admin" on ai_draft_versions
  for select to authenticated using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = ai_draft_versions.trip_id
        and trip_members.user_id = auth.uid()
        and trip_members.role = 'admin'
    )
  );
