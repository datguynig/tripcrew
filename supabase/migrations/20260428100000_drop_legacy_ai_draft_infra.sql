-- Drop the legacy AI draft infrastructure: ai_draft_versions snapshots,
-- ai_feedback per-surface ratings, and the profiles.ai_enabled flag.
-- All replaced by the unified Lock & Draft flow which uses ai_usage for
-- cost telemetry only.

drop table if exists public.ai_draft_versions cascade;
drop table if exists public.ai_feedback cascade;

alter table public.profiles drop column if exists ai_enabled;
