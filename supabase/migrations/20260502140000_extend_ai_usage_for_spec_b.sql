-- Extend ai_usage_feature_check to recognise the Spec B feature names:
-- lock_and_draft_places_resolution (Phase 1 batched Places lookup),
-- lock_and_draft_pricing_hotels and lock_and_draft_pricing_flights
-- (Phase 2 SerpApi pricing telemetry).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'ai_usage_feature_check'
  ) then
    alter table ai_usage drop constraint ai_usage_feature_check;
  end if;
end $$;

alter table ai_usage add constraint ai_usage_feature_check
  check (
    feature in (
      'lock_and_draft_basic',
      'lock_and_draft_enriched',
      'lock_and_draft_places_resolution',
      'lock_and_draft_pricing_hotels',
      'lock_and_draft_pricing_flights',
      'price_refresh',
      'candidate_draft_basic',
      'curated_teaser',
      'concierge_chat'
    )
  );
