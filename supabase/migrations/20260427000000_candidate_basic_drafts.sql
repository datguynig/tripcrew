-- ============================================================
-- Per-candidate basic drafts (paid-tier "draft plans for all
-- shortlisted candidates" feature). Stores a cheap basic-tier
-- AI plan on each destination_candidate so the crew can vote on
-- plans rather than just place names. The expensive enriched
-- draft remains a single column on `trips`, generated post-lock
-- via the existing lock-and-draft flow.
-- ============================================================

alter table destination_candidates
  add column if not exists basic_draft jsonb;

alter table destination_candidates
  add column if not exists basic_draft_generated_at timestamptz;

-- Extend the ai_usage feature constraint to recognise the new
-- per-candidate basic-draft feature. Drop + recreate is the only
-- way to widen a CHECK constraint in Postgres.
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
      'candidate_draft_basic'
    )
  );
