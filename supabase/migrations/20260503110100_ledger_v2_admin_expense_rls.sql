-- supabase/migrations/20260503110100_ledger_v2_admin_expense_rls.sql
-- Ledger v2 Phase 1 · let trip admins update and delete expenses.
--
-- Phase 1 server actions (editExpense, deleteExpense, restoreExpense) check
-- "payer or trip admin" in TypeScript, then write through the user-scoped
-- Supabase client. The init schema only allows the payer at the RLS layer,
-- so the admin path silently no-op'd. These additive PERMISSIVE policies
-- OR with the existing payer policies, so payer writes still work and
-- trip admins can now act on any expense in their trip.
--
-- expense_participants already grants admin write via the policy in
-- 20260503100100; this migration brings expenses to parity.

create policy "expenses_update_admin" on expenses
  for update to authenticated using (
    exists (
      select 1 from trip_members
      where trip_id = expenses.trip_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy "expenses_delete_admin" on expenses
  for delete to authenticated using (
    exists (
      select 1 from trip_members
      where trip_id = expenses.trip_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );
