-- supabase/migrations/20260503110000_ledger_v2_backfill_rounding_fix.sql
-- Repair off-by-pennies sums introduced by the first version of the
-- ledger v2 backfill (20260503100200). The original loop computed one
-- per_share and inserted it for every member, so e.g. £100 split 3
-- ways became 33.33 * 3 = 99.99. The intended sum across inserted
-- (non-phantom) rows is round(amount * joined / target, 2), matching
-- applyRoundingRemainder in src/lib/ledger/shares.ts.
--
-- Idempotent: a fresh-clone environment runs the corrected version of
-- 20260503100200 first, so the diff computed here is zero and no rows
-- update.

do $$
declare
  e record;
  trip_target int;
  trip_members_count int;
  intended_sum numeric(12, 2);
  current_sum numeric(12, 2);
  remainder numeric(12, 2);
  last_participant_id uuid;
begin
  for e in
    select id, trip_id, amount
    from expenses
    where deleted_at is null
      and exists (
        select 1 from expense_participants ep
        where ep.expense_id = expenses.id
          and ep.share_basis = 'equal'
          and ep.deleted_at is null
      )
  loop
    select target_crew_size into trip_target from trips where id = e.trip_id;
    if trip_target is null or trip_target <= 0 then
      trip_target := 1;
    end if;

    select count(*) into trip_members_count
      from expense_participants
      where expense_id = e.id and share_basis = 'equal' and deleted_at is null;

    if trip_members_count = 0 then
      continue;
    end if;

    intended_sum := round(e.amount * trip_members_count::numeric / trip_target, 2);
    select coalesce(sum(share_amount), 0) into current_sum
      from expense_participants
      where expense_id = e.id and share_basis = 'equal' and deleted_at is null;

    remainder := intended_sum - current_sum;
    if remainder = 0 then
      continue;
    end if;

    select id into last_participant_id
      from expense_participants
      where expense_id = e.id and share_basis = 'equal' and deleted_at is null
      order by user_id desc
      limit 1;

    if last_participant_id is not null then
      update expense_participants
        set share_amount = share_amount + remainder
        where id = last_participant_id;
    end if;
  end loop;
end $$;
