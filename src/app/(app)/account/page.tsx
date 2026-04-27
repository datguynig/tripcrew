import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SubscriptionPanel } from "@/components/account/SubscriptionPanel";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

type SearchParams = { checkout?: string };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const params = await searchParams;
  const canceled = params.checkout === "canceled";

  return (
    <section className="py-14 pb-24 section-enter">
      <SectionHeader
        code="§ ¤"
        title="Account."
        lead="Crew Plus subscription and password."
      />

      {canceled && (
        <div
          role="status"
          className="mb-8 border border-line bg-bg-2 px-5 py-3 flex items-center gap-3 text-[13px] text-fg-2"
        >
          <span className="w-[6px] h-[6px] rounded-full bg-warn" aria-hidden />
          Checkout cancelled. Your card wasn&apos;t charged.
        </div>
      )}

      <div className="grid gap-12 max-w-[680px]">
        <div className="grid gap-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-3">
            Subscription
          </h2>
          <SubscriptionPanel profile={user.profile} />
        </div>

        <div className="grid gap-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-3">
            Password
          </h2>
          <p className="text-fg-2 text-[14px] leading-[1.55]">
            Set or change the password on {user.email}. Next time you sign in,
            you can use email + password instead of waiting for a magic link.
          </p>
          <PasswordForm />
        </div>
      </div>
    </section>
  );
}
