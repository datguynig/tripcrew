-- M1 conversational concierge.
-- Per-user, per-trip chat thread. Each (trip_id, user_id) pair is one
-- conversation; multi-user trips have parallel threads, no shared log.
-- Pioneer-gated at the application layer.

create table if not exists concierge_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Structured proposal cards the agent emits via propose_* tool calls.
  -- Each entry is { type, payload, applied_at? } so the UI can render
  -- "Apply" buttons that hit existing inline-edit server actions.
  proposals jsonb,
  token_in integer,
  token_out integer,
  created_at timestamptz not null default now()
);

create index if not exists concierge_messages_thread_idx
  on concierge_messages(trip_id, user_id, created_at);

alter table concierge_messages enable row level security;

-- Read: member of the trip + own thread only. Other crew members
-- cannot see your concierge thread, even on a shared trip.
create policy concierge_messages_select_own_thread
  on concierge_messages for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from trip_members
      where trip_members.trip_id = concierge_messages.trip_id
        and trip_members.user_id = auth.uid()
    )
  );

-- No insert / update / delete policies. The chat server action runs as
-- the service role, validates trip membership + Pioneer status, then
-- writes both the user and assistant messages.

-- Extend ai_usage_feature_check to recognise the concierge feature.
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
      'price_refresh',
      'candidate_draft_basic',
      'curated_teaser',
      'concierge_chat'
    )
  );
