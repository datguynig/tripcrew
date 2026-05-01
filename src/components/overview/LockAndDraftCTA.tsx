"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { generateLockAndDraft } from "@/lib/actions/lockAndDraft";

type Props = {
  tripId: string;
  userId: string;
  destination: string;
  variant?: "initial" | "regenerate";
};

export function LockAndDraftCTA({
  tripId,
  userId,
  destination,
  variant = "initial",
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const handleClick = () => {
    setUpgradeError(null);
    startTransition(async () => {
      const result = await generateLockAndDraft({ tripId, userId });
      if (result.success) {
        toast.success(
          result.tier === "enriched"
            ? "Plan drafted with live places + weather."
            : "Plan drafted. Upgrade for itinerary, hotels, budget.",
        );
        router.refresh();
        return;
      }
      if (result.upgradeCta) {
        setUpgradeError(result.error);
      } else {
        toast.error(result.error);
      }
    });
  };

  if (variant === "regenerate") {
    return (
      <div className="flex flex-col items-start gap-3">
        <Button
          variant="secondary"
          tone="accent"
          size="sm"
          onClick={handleClick}
          disabled={pending}
        >
          {pending ? "Regenerating…" : "Regenerate plan"}
        </Button>
        {upgradeError && <UpgradeNotice message={upgradeError} />}
      </div>
    );
  }

  return (
    <div className="border border-accent/40 bg-accent/[0.04] mb-10 px-7 py-10 max-[640px]:px-5 max-[640px]:py-8">
      <div className="flex items-center gap-2 mb-5">
        <span
          className="w-[6px] h-[6px] rounded-full bg-accent brand-dot"
          aria-hidden="true"
        />
        <span className="label-sm text-accent">AI · Travel plan</span>
      </div>

      <h3 className="text-[40px] max-[640px]:text-[30px] font-medium tracking-[-0.03em] leading-[1.02] mb-5 max-w-[720px]">
        Draft a travel plan for {destination}
        <span className="text-accent">.</span>
      </h3>

      <p className="text-fg-2 text-[15px] leading-[1.55] max-w-[600px] mb-8">
        Where to stay, day-by-day itinerary, what to book ahead, and a budget
        range. Grounded in live Google Places data and the weather forecast
        for your dates. Free plans get a summary; Membership unlocks the full
        plan. Separate from the §01 brief setup above.
      </p>

      <div className="flex items-center gap-6 flex-wrap">
        <Button tone="accent" size="lg" onClick={handleClick} disabled={pending}>
          {pending ? "Drafting…" : "Draft travel plan →"}
        </Button>
      </div>

      {upgradeError && (
        <div className="mt-6">
          <UpgradeNotice message={upgradeError} />
        </div>
      )}
    </div>
  );
}

function UpgradeNotice({ message }: { message: string }) {
  return (
    <div className="border border-accent/30 bg-accent/[0.06] px-4 py-3 flex items-center gap-4 flex-wrap text-[13px]">
      <span className="text-fg-2">{message}</span>
      <Link
        href="/account"
        className="label-sm-wide text-accent hover:underline shrink-0"
      >
        Upgrade →
      </Link>
    </div>
  );
}
