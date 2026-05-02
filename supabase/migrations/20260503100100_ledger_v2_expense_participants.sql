-- supabase/migrations/20260503100100_ledger_v2_expense_participants.sql
-- Ledger v2 Phase 1 · expense_participants table (replaces implicit even-split)

create table if not exists expense_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  share_amount numeric(12, 2) not null,
  share_basis text not null check (share_basis in ('equal', 'percentage', 'exact')),
  share_input numeric(12, 4) null,
  display_name_snapshot text not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists expense_participants_trip_idx
  on expense_participants (trip_id) where deleted_at is null;
create index if not exists expense_participants_expense_idx
  on expense_participants (expense_id) where deleted_at is null;
create index if not exists expense_participants_user_idx
  on expense_participants (user_id) where deleted_at is null;

alter table expense_participants enable row level security;

-- Read: any current trip member can read participant rows for trips they belong to.
create policy expense_participants_read on expense_participants
  for select to authenticated
  using (
    exists (
      select 1 from trip_members
      where trip_id = expense_participants.trip_id and user_id = auth.uid()
    )
  );

-- Write: only the original payer of the linked expense or a trip admin.
-- Server actions enforce this in addition; RLS is defence-in-depth.
create policy expense_participants_write on expense_participants
  for all to authenticated
  using (
    exists (
      select 1 from expenses e
      where e.id = expense_participants.expense_id
        and (
          e.paid_by = auth.uid()
          or exists (
            select 1 from trip_members tm
            where tm.trip_id = expense_participants.trip_id
              and tm.user_id = auth.uid()
              and tm.role = 'admin'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from expenses e
      where e.id = expense_participants.expense_id
        and (
          e.paid_by = auth.uid()
          or exists (
            select 1 from trip_members tm
            where tm.trip_id = expense_participants.trip_id
              and tm.user_id = auth.uid()
              and tm.role = 'admin'
          )
        )
    )
  );
