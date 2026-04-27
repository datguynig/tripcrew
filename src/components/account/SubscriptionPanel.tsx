import type { Profile } from "@/lib/types";
import { UpgradeButton } from "./UpgradeButton";
import { ManageSubscriptionButton } from "./ManageSubscriptionButton";

type Props = {
  profile: Profile;
};

const PRICE_LABEL = "£4.99/mo";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function SubscriptionPanel({ profile }: Props) {
  const status = profile.stripe_subscription_status;
  const periodEnd = profile.current_period_end;

  // Free state — no subscription on file.
  if (!status) {
    return (
      <article className="border border-accent/40 bg-accent/[0.04] px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-5">
        <div className="flex items-center gap-2">
          <span
            className="w-[6px] h-[6px] rounded-full bg-accent brand-dot"
            aria-hidden="true"
          />
          <span className="label-sm text-accent">CREW PLUS</span>
        </div>
        <div className="grid gap-3 max-w-[520px]">
          <h3 className="text-[26px] max-[640px]:text-[22px] font-medium tracking-[-0.025em] leading-[1.15]">
            Plan trips with AI for the whole crew
            <span className="text-accent">.</span>
          </h3>
          <p className="text-[14px] text-fg-2 leading-[1.55]">
            {PRICE_LABEL}, 7-day free trial. Buy once for your crew — every trip
            you organise unlocks Crew Plus for everyone on it.
          </p>
        </div>
        <ul className="grid gap-1.5 text-[13px] text-fg-2 leading-[1.5]">
          <li>· Plan every shortlisted destination so the crew votes on plans, not just place names</li>
          <li>· Regenerate enriched plans with weather, hotels, day-by-day itinerary, budget</li>
          <li>· Refresh price checks anytime, cancel anytime via Stripe</li>
        </ul>
        <div className="flex items-center gap-4 flex-wrap mt-1">
          <UpgradeButton />
          <span className="label-xs text-fg-3">No charge during trial · cancel any time</span>
        </div>
      </article>
    );
  }

  // Trialing — Stripe-managed trial; current_period_end is the trial end.
  if (status === "trialing") {
    const days = daysUntil(periodEnd);
    return (
      <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-ok" aria-hidden />
          <span className="label-sm text-fg-3">CREW PLUS · TRIAL</span>
        </div>
        <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
          Trial active.
        </h3>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
          Your trial ends {formatDate(periodEnd)}
          {days !== null ? ` (in ${days} day${days === 1 ? "" : "s"})` : ""}.
          After that you'll be charged {PRICE_LABEL}. Cancel any time before
          then to avoid the charge.
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <ManageSubscriptionButton />
        </div>
      </article>
    );
  }

  if (status === "active") {
    return (
      <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-ok" aria-hidden />
          <span className="label-sm text-fg-3">CREW PLUS</span>
        </div>
        <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
          Active.
        </h3>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
          Renews {formatDate(periodEnd)} at {PRICE_LABEL}. Manage payment
          method, pause, or cancel any time.
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <ManageSubscriptionButton />
        </div>
      </article>
    );
  }

  if (status === "past_due") {
    return (
      <article className="border border-err/40 bg-err/[0.06] px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-err" aria-hidden />
          <span className="label-sm text-err">PAYMENT NEEDED</span>
        </div>
        <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
          Last payment failed.
        </h3>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
          Update your card to keep Crew Plus active. We'll retry the
          subscription as soon as the card is fixed.
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <ManageSubscriptionButton label="Update billing" variant="primary" />
        </div>
      </article>
    );
  }

  if (status === "incomplete") {
    return (
      <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-warn" aria-hidden />
          <span className="label-sm text-fg-3">AWAITING PAYMENT</span>
        </div>
        <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
          Subscription incomplete.
        </h3>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
          We didn't receive payment confirmation. Finish setup to start your
          trial, or contact support if this looks wrong.
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <ManageSubscriptionButton />
        </div>
      </article>
    );
  }

  // canceled
  return (
    <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
      <div className="flex items-center gap-2">
        <span className="w-[6px] h-[6px] rounded-full bg-fg-3" aria-hidden />
        <span className="label-sm text-fg-3">CREW PLUS · ENDING</span>
      </div>
      <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
        Subscription ending {formatDate(periodEnd)}.
      </h3>
      <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
        You'll keep Crew Plus until then. Reactivate any time to keep the
        crew on the paid tier.
      </p>
      <div className="flex items-center gap-3 flex-wrap mt-1">
        <UpgradeButton label="Resubscribe" />
        <ManageSubscriptionButton label="Manage" variant="secondary" />
      </div>
    </article>
  );
}
