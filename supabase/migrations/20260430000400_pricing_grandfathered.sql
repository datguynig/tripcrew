-- 20260430000400_pricing_grandfathered.sql
-- Stamps the moment a founder's price was locked in. Read by future
-- post-cohort pricing logic so Founding Crew members keep £179/yr
-- after the cohort closes and Crew Concierge launches at £29/mo for
-- new buyers. Stripe webhook writes this at the same moment it writes
-- founding_crew_at. Nullable so existing rows are unaffected.

alter table profiles add column pricing_grandfathered_at timestamptz;

create index profiles_pricing_grandfathered_idx
  on profiles(pricing_grandfathered_at)
  where pricing_grandfathered_at is not null;
