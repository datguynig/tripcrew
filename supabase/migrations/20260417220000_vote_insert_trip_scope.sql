-- ============================================================
-- Tighten vote INSERT policies to require trip membership.
--
-- Previously `votes_insert_self` and `dest_votes_insert_self` only checked
-- user_id = auth.uid(). That let any signed-in user insert a vote for any
-- activity_id / candidate_id they could name — privilege escalation if a
-- UUID leaked. Practical risk is low (UUIDs aren't guessable) but this is
-- defense in depth.
--
-- Read, update, delete policies are unchanged: read is already member-gated,
-- update/delete only touch the user's own rows which is harmless.
-- ============================================================

drop policy if exists "votes_insert_self" on votes;
create policy "votes_insert_self_if_trip_member" on votes
  for insert to authenticated with check (
    user_id = auth.uid()
    and is_trip_member((select trip_id from activities where id = activity_id))
  );

drop policy if exists "dest_votes_insert_self" on destination_votes;
create policy "dest_votes_insert_self_if_trip_member" on destination_votes
  for insert to authenticated with check (
    user_id = auth.uid()
    and is_trip_member((select trip_id from destination_candidates where id = candidate_id))
  );
