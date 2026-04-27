-- 20260429000200_founding_crew_flag.sql
-- The "47 / 500 LEFT" counter on the pricing block reads from
-- count(profiles.founding_crew_at is not null). Stripe webhook stamps
-- this column when a customer.subscription.created arrives with the
-- founding-crew price ID. Nullable so existing rows are unaffected.

alter table profiles add column founding_crew_at timestamptz;

create index profiles_founding_crew_idx on profiles(founding_crew_at) where founding_crew_at is not null;
