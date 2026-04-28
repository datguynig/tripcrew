-- Keep Crew Plus access during Stripe's dunning/retry period.
--
-- Product copy and account UI treat `past_due` as paid access that needs
-- billing attention, not an immediate feature lockout. Mirror that in the
-- database plan resolver so SQL/RPC gates stay aligned with app-side gates.

create or replace function get_user_plan(p_user_id uuid) returns text as $$
declare
  p profiles%rowtype;
begin
  select * into p from profiles where id = p_user_id;

  if p is null then
    return 'free';
  end if;

  if p.stripe_subscription_status in ('active', 'trialing', 'past_due') then
    return 'pro';
  end if;

  if p.trial_started_at is not null
     and p.trial_started_at > now() - interval '7 days' then
    return 'trial';
  end if;

  return 'free';
end;
$$ language plpgsql stable security definer;
