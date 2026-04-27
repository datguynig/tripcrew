import Link from "next/link";
import type { Profile } from "@/lib/types";

/**
 * Persistent "PRO" / "TRIAL" chip in the topbar so paying users can
 * always see at a glance which tier they're on. Clicks through to
 * /account where they manage the subscription. Renders nothing for
 * free users.
 */

type Props = {
  profile: Profile;
};

export function PlanBadge({ profile }: Props) {
  const status = profile.stripe_subscription_status;
  if (!status || status === "canceled" || status === "incomplete") return null;

  // past_due gets the warn variant — it's "Pro for now" but needs attention.
  const isTrial = status === "trialing";
  const isPastDue = status === "past_due";

  const label = isTrial
    ? "TRIAL"
    : isPastDue
      ? "PAST DUE"
      : "CREW PLUS";
  const aria = isTrial
    ? "Crew Plus trial active — manage subscription"
    : isPastDue
      ? "Crew Plus payment past due — update billing"
      : "Crew Plus active — manage subscription";

  const className = isPastDue
    ? "bg-err/15 text-err border border-err/40"
    : "bg-accent text-[#140400] border border-accent";

  return (
    <Link
      href="/account"
      aria-label={aria}
      title={aria}
      className={`hidden sm:inline-flex items-center font-mono text-[9px] tracking-[0.18em] uppercase font-semibold px-[7px] h-[20px] rounded-[3px] transition-opacity hover:opacity-90 active:opacity-80 ${className}`}
    >
      {label}
    </Link>
  );
}
