-- supabase/migrations/20260503100200_ledger_v2_backfill_participants.sql
-- Ledger v2 Phase 1 · backfill expense_participants from legacy expenses
--
-- For each existing expense row, create one participant row per current
-- trip member with share_amount = expenses.amount / target_crew_size.
-- This preserves historical even-split math exactly. When joined <
-- target_crew_size, sum(participants.share_amount) < expenses.amount;
-- the shortfall is the implicit "phantom share" that was never
-- allocated. We tag the trip's meta with a migration warning so admins
-- can resolve it (accept, or invite + re-edit).

do $$
declare
  e record;
  m record;
  per_share numeric(12, 2);
  trip_target int;
  trip_members_count int;
  any_warning boolean;
begin
  for e in
    select id, trip_id, amount from expenses where deleted_at is null
  loop
    -- Read target_crew_size for the divisor (preserve historical math)
    select target_crew_size into trip_target from trips where id = e.trip_id;
    if trip_target is null or trip_target <= 0 then
      trip_target := 1;
    end if;

    select count(*) into trip_members_count from trip_members where trip_id = e.trip_id;
    per_share := round(e.amount / trip_target, 2);

    -- Insert one participant row per current trip member with their snapshot name
    for m in
      select tm.user_id, p.name
      from trip_members tm
      join profiles p on p.id = tm.user_id
      where tm.trip_id = e.trip_id
    loop
      insert into expense_participants (
        trip_id, expense_id, user_id, share_amount,
        share_basis, share_input, display_name_snapshot
      ) values (
        e.trip_id, e.id, m.user_id, per_share,
        'equal', null, m.name
      )
      on conflict do nothing;
    end loop;

    -- Tag the trip if joined < target so admins see a one-time banner
    if trip_members_count < trip_target then
      update trips
      set meta = coalesce(meta, '{}'::jsonb)
              || jsonb_build_object(
                'migration_warnings',
                coalesce(meta -> 'migration_warnings', '{}'::jsonb)
                  || jsonb_build_object(
                       'ledger_v2_phantom_shares', jsonb_build_object(
                         'shown', false,
                         'target_crew_size', trip_target,
                         'joined_count', trip_members_count
                       )
                     )
              )
      where id = e.trip_id;
    end if;
  end loop;
end $$;
