-- ============================================================
-- trip_meta
-- Adds top-level display columns to trips (hero_title, hero_subtitle,
-- city_label, dates_label, target_budget_pp). The meta jsonb column
-- already exists (from multi_trip_pivot). Phase F2+ populates meta
-- with { spec, schedule, section_leads } via admin UI.
--
-- No seed block: Stockholm was wiped in multi_trip_pivot; any trips
-- created during testing keep empty meta until edited.
-- ============================================================

alter table trips
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text,
  add column if not exists city_label text,
  add column if not exists dates_label text,
  add column if not exists target_budget_pp numeric(10, 2);
