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
  intended_sum numeric(12, 2);
  current_sum numeric(12, 2);
  remainder numeric(12, 2);
  last_participant_id uuid;
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
      order by tm.user_id
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

    -- Absorb the rounding remainder into the last inserted row so the sum
    -- of inserted shares equals round(amount * joined_count / target, 2),
    -- which mirrors applyRoundingRemainder in src/lib/ledger/shares.ts.
    if trip_members_count > 0 then
      intended_sum := round(e.amount * trip_members_count::numeric / trip_target, 2);
      select coalesce(sum(share_amount), 0) into current_sum
        from expense_participants
        where expense_id = e.id and share_basis = 'equal' and deleted_at is null;
      remainder := intended_sum - current_sum;
      if remainder <> 0 then
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
      end if;
    end if;

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
