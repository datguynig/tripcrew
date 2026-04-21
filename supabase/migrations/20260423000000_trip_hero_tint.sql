-- ============================================================
-- Trip hero tint — powers the per-trip atmospheric radial.
--
-- Stores a dominant `rgba(...)` value extracted from the hero
-- photo at lock time. Rendered as a soft radial wash at the
-- top of every trip-scoped page so glass surfaces have
-- something to blur over. Fallback (null) resolves to the
-- existing accent-coral radial client-side.
--
-- Additive + idempotent. No destructive ops.
-- ============================================================

alter table trips
  add column if not exists hero_tint text;
