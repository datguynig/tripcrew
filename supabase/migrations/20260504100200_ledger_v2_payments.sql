-- supabase/migrations/20260504100200_ledger_v2_payments.sql
-- Ledger v2 Phase 2 · payments table

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references payment_obligations(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  recorded_by uuid not null references profiles(id),
  recorded_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'voided')),
  verified_by uuid null references profiles(id),
  verified_at timestamptz null,
  rejected_by uuid null references profiles(id),
  rejected_at timestamptz null,
  rejection_note text null,
  voided_by uuid null references profiles(id),
  voided_at timestamptz null,
  void_reason text null,
  note text null,
  -- Field-consistency guards (CHECK can validate this row but cannot
  -- compare against the previous row state; transition validity lives
  -- in the server-action layer).
  check ((status = 'verified') = (verified_at is not null)),
  check ((status = 'rejected') = (rejected_at is not null)),
  check ((status = 'voided') = (voided_at is not null))
);

create index if not exists payments_obligation_status_idx
  on payments (obligation_id, status);

alter table payments enable row level security;

create policy payments_read on payments
  for select to authenticated
  using (
    exists (
      select 1 from payment_obligations po
      join trip_members tm on tm.trip_id = po.trip_id
      where po.id = payments.obligation_id and tm.user_id = auth.uid()
    )
  );
