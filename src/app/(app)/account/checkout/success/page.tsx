import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "soon";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "soon";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CheckoutSuccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Webhook is authoritative; by the time this page renders the row may or
  // may not be updated yet (webhook is racing with the redirect). Render
  // optimistically based on whatever's in the profile right now and trust
  // realtime / a manual refresh to catch up if the webhook hasn't landed yet.
  const status = user.profile.stripe_subscription_status;
  const periodEnd = user.profile.current_period_end;
  const isActive = status === "active" || status === "trialing";

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ ¤"
        title="You're in."
        lead={
          isActive
            ? `Membership is active. Next charge ${formatDate(periodEnd)}.`
            : "Stripe is finalising your subscription. Refresh in a few seconds."
        }
      />

      <div className="border border-line bg-bg-2 px-7 py-8 max-w-[560px] grid gap-5">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-ok" aria-hidden />
          <span className="label-sm text-fg-3">MEMBER</span>
        </div>
        <p className="text-[15px] text-fg leading-[1.55]">
          Every trip you organise from now on unlocks Member access for
          everyone on the crew. Plan every shortlisted destination,
          regenerate enriched plans, refresh price checks.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 border border-line bg-bg-2 hover:bg-bg-3 px-5 h-10 text-[13px] font-semibold transition-colors"
          >
            Back to account
            <span className="text-accent">→</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-3 h-10 text-[13px] text-fg-2 hover:text-fg transition-colors"
          >
            Or jump to your trips
          </Link>
        </div>
      </div>
    </section>
  );
}
