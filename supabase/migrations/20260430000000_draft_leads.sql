-- 20260430000000_draft_leads.sql
-- Lead-magnet capture for curated trip personalised teaser flow.
-- One row per (cache_key, ip_hash). Rate-limited to 2 per ip_hash lifetime
-- in the application layer; cache lookup happens before AI call.

create table if not exists draft_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_hash text not null,
  slug text not null,
  inputs jsonb not null,
  teaser jsonb,
  cache_key text not null,
  resume_token text not null default encode(gen_random_bytes(32), 'hex'),
  nudge_sent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create index draft_leads_cache_key_idx on draft_leads (cache_key);
create index draft_leads_ip_idx on draft_leads (ip_hash);
create index draft_leads_email_idx on draft_leads (email);
create index draft_leads_resume_token_idx on draft_leads (resume_token);
create index draft_leads_nudge_eligible_idx on draft_leads (created_at)
  where nudge_sent_at is null and unsubscribed_at is null;

alter table draft_leads enable row level security;

create policy "draft_leads_anon_insert" on draft_leads
  for insert
  to anon, authenticated
  with check (true);

-- Read/update/delete: service-role only (no policies).
