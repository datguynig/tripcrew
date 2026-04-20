-- ============================================================
-- Destination candidate coordinates
--
-- Store the Mapbox Search Box identifier plus longitude/latitude
-- for each candidate. Optional — candidates proposed before this
-- migration (or without a Mapbox selection) keep the columns null
-- and the UI falls back to title-only rendering.
-- ============================================================

alter table destination_candidates
  add column if not exists mapbox_id text,
  add column if not exists longitude double precision,
  add column if not exists latitude double precision,
  add column if not exists country text;

create index if not exists idx_destination_candidates_mapbox_id
  on destination_candidates(mapbox_id)
  where mapbox_id is not null;
