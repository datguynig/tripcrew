-- supabase/migrations/20260504100100_ledger_v2_payment_obligations.sql
-- Ledger v2 Phase 2 · obligations table

create table if not exists payment_obligations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  expense_id uuid null references expenses(id) on delete cascade,
  expense_version int null,
  debtor_id uuid not null references profiles(id) on delete restrict,
  creditor_id uuid not null references profiles(id) on delete restrict,
  debtor_name_snapshot text not null,
  creditor_name_snapshot text not null,
  due_date date null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null,
  installment_index int null,
  status text not null default 'open'
    check (status in ('open', 'superseded', 'voided')),
  superseded_by uuid null references payment_obligations(id),
  voided_by uuid null references profiles(id),
  voided_at timestamptz null,
  void_reason text null,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id),
  check (debtor_id <> creditor_id),
  check ((status = 'voided') = (voided_at is not null))
);

create index if not exists payment_obligations_trip_status_due_idx
  on payment_obligations (trip_id, status, due_date);
create index if not exists payment_obligations_debtor_status_idx
  on payment_obligations (debtor_id, status);
create index if not exists payment_obligations_expense_open_idx
  on payment_obligations (expense_id) where status = 'open';

alter table payment_obligations enable row level security;

create policy payment_obligations_read on payment_obligations
  for select to authenticated
  using (
    exists (
      select 1 from trip_members
      where trip_id = payment_obligations.trip_id and user_id = auth.uid()
    )
  );

-- Writes go through server actions (service role); RLS denies direct
-- client writes by omission.
