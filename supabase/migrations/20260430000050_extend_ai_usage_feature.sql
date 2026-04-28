-- Extend ai_usage_feature_check to recognise the curated-teaser flow.
-- Drop + recreate is the only way to widen a CHECK constraint in Postgres.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'ai_usage_feature_check'
  ) then
    alter table ai_usage drop constraint ai_usage_feature_check;
  end if;
end $$;

alter table ai_usage add constraint ai_usage_feature_check
  check (
    feature in (
      'lock_and_draft_basic',
      'lock_and_draft_enriched',
      'price_refresh',
      'candidate_draft_basic',
      'curated_teaser'
    )
  );
