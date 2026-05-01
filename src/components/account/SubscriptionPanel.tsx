import Link from "next/link";
import type { ReactNode } from "react";
import { FounderBadge } from "@/components/ui/FounderBadge";
import type { Profile } from "@/lib/types";
import { UpgradeButton } from "./UpgradeButton";
import { ManageSubscriptionButton } from "./ManageSubscriptionButton";

type Props = {
  profile: Profile;
};

const PRICE_LABEL = "£9/mo";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function SubscriptionPanel({ profile }: Props) {
  const status = profile.stripe_subscription_status;
  const periodEnd = profile.current_period_end;
  const founderStatus = profile.founding_crew_at ? (
    <div className="mb-6 flex items-center gap-3 border border-line bg-bg-2 px-5 py-4">
      <FounderBadge size="lg" />
      <div className="flex flex-col">
        <span className="text-[14px] text-fg leading-[1.3]">
          You are a Founding Crew member.
        </span>
        <span className="text-[12px] text-fg-3 leading-[1.3]">
          Price-locked at £179/yr for life. Joined{" "}
          {new Date(profile.founding_crew_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </span>
      </div>
    </div>
  ) : null;
  const withFounderStatus = (content: ReactNode) => (
    <>
      {founderStatus}
      {content}
    </>
  );

  // Free state — no subscription on file.
  if (!status) {
    return withFounderStatus(
      <article className="border border-accent/40 bg-accent/[0.04] px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-5">
        <div className="flex items-center gap-2">
          <span
            className="w-[6px] h-[6px] rounded-full bg-accent brand-dot"
            aria-hidden="true"
          />
          <span className="label-sm text-accent">MEMBER</span>
        </div>
        <div className="grid gap-3 max-w-[520px]">
          <h3 className="text-[26px] max-[640px]:text-[22px] font-medium tracking-[-0.025em] leading-[1.15]">
            Plan trips with AI for the whole crew
            <span className="text-accent">.</span>
          </h3>
          <p className="text-[14px] text-fg-2 leading-[1.55]">
            {PRICE_LABEL}, or £79/year. Apply once for Cohort 01. One admin
            pays; every trip you organise unlocks Member access for everyone on it.
          </p>
        </div>
        <ul className="grid gap-1.5 text-[13px] text-fg-2 leading-[1.5]">
          <li>· Plan every shortlisted destination so the crew votes on plans, not just place names</li>
          <li>· Regenerate enriched plans with weather, hotels, day-by-day itinerary, budget</li>
          <li>· Refresh price checks anytime, cancel anytime via Stripe</li>
        </ul>
        <div className="flex items-center gap-4 flex-wrap mt-1">
          <Link
            href="/apply?intent=plus"
            className="inline-flex items-center gap-2 rounded-[3px] bg-accent px-5 h-11 text-[13px] font-semibold text-[#140400] transition-opacity hover:opacity-90 active:opacity-80"
          >
            Apply to Yenkoh
            <span aria-hidden="true">→</span>
          </Link>
          <span className="label-xs text-fg-3">14-day refund on first-time subscriptions</span>
        </div>
      </article>,
    );
  }

  // Legacy trialing rows are still treated as paid access, but new
  // Cohort 01 checkout no longer creates trial subscriptions.
  if (status === "trialing") {
    return withFounderStatus(
      <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-ok" aria-hidden />
          <span className="label-sm text-fg-3">MEMBER</span>
        </div>
        <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
          Active.
        </h3>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
          Membership is active. Your current period ends {formatDate(periodEnd)}.
          Manage billing in Stripe.
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <ManageSubscriptionButton />
        </div>
      </article>,
    );
  }

  if (status === "active") {
    return withFounderStatus(
      <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-ok" aria-hidden />
          <span className="label-sm text-fg-3">MEMBER</span>
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
      </article>,
    );
  }

  if (status === "past_due") {
    return withFounderStatus(
      <article className="border border-err/40 bg-err/[0.06] px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-err" aria-hidden />
          <span className="label-sm text-err">PAYMENT NEEDED</span>
        </div>
        <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
          Last payment failed.
        </h3>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
          Update your card to keep Membership active. We'll retry the
          subscription as soon as the card is fixed.
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <ManageSubscriptionButton label="Update billing" variant="primary" />
        </div>
      </article>,
    );
  }

  if (status === "incomplete") {
    return withFounderStatus(
      <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-warn" aria-hidden />
          <span className="label-sm text-fg-3">AWAITING PAYMENT</span>
        </div>
        <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
          Subscription incomplete.
        </h3>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
          We didn't receive payment confirmation. Finish setup to activate
          Membership, or contact support if this looks wrong.
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <ManageSubscriptionButton />
        </div>
      </article>,
    );
  }

  // canceled
  return withFounderStatus(
    <article className="border border-line bg-bg-2 px-7 py-8 max-[640px]:px-5 max-[640px]:py-7 grid gap-4">
      <div className="flex items-center gap-2">
        <span className="w-[6px] h-[6px] rounded-full bg-fg-3" aria-hidden />
        <span className="label-sm text-fg-3">MEMBER · ENDING</span>
      </div>
      <h3 className="text-[24px] font-medium tracking-[-0.02em] leading-[1.15]">
        Subscription ending {formatDate(periodEnd)}.
      </h3>
      <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[520px]">
        You'll keep Membership until then. Reactivate any time to keep the
        crew on the paid tier.
      </p>
      <div className="flex items-center gap-3 flex-wrap mt-1">
        <UpgradeButton label="Resubscribe" />
        <ManageSubscriptionButton label="Manage" variant="secondary" />
      </div>
    </article>,
  );
}
