-- ============================================================
-- Allow 'trialing' as a distinct profiles.stripe_subscription_status
-- value so the /account UI can render trial-specific copy ("Trial
-- ends DD MMM"). Previously the webhook coerced Stripe's 'trialing'
-- to 'active' for storage because the constraint disallowed it. We
-- keep the gate semantics identical (both 'trialing' and 'active'
-- unlock features) by also updating the get_user_plan() function.
-- ============================================================

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_stripe_subscription_status_check'
  ) then
    alter table profiles drop constraint profiles_stripe_subscription_status_check;
  end if;
end $$;

alter table profiles add constraint profiles_stripe_subscription_status_check
  check (
    stripe_subscription_status is null
    or stripe_subscription_status in (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete'
    )
  );

-- Update the plan resolver to treat 'trialing' as 'pro' (same as
-- 'active'). The legacy `trial_started_at`-based trial path is left
-- intact for any rows that still rely on it, but new flows use the
-- Stripe-managed trial via Checkout instead.
create or replace function get_user_plan(p_user_id uuid) returns text as $$
declare
  p profiles%rowtype;
begin
  select * into p from profiles where id = p_user_id;

  if p is null then
    return 'free';
  end if;

  if p.stripe_subscription_status in ('active', 'trialing') then
    return 'pro';
  end if;

  if p.trial_started_at is not null
     and p.trial_started_at > now() - interval '7 days' then
    return 'trial';
  end if;

  return 'free';
end;
$$ language plpgsql stable security definer;
