"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { generateLockAndDraft } from "@/lib/actions/lockAndDraft";
import { createClient } from "@/lib/supabase/client";
import type { DraftProgress, TripMeta } from "@/lib/types";
import { DraftingProgress } from "./DraftingProgress";

type Props = {
  tripId: string;
  userId: string;
  destination: string;
  // The server's view of enriched_draft_generated_at at render time.
  initialDraftedAt: string | null;
  // Server-rendered draft_progress so we don't flash an empty state
  // before realtime kicks in.
  initialProgress: DraftProgress | null;
};

export function DraftingFlow({
  tripId,
  userId,
  destination,
  initialDraftedAt,
  initialProgress,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DraftProgress | null>(initialProgress);

  const justLocked = searchParams.get("drafting") === "1";
  const [draftingFromUrl, setDraftingFromUrl] = useState(justLocked);
  // We're "drafting" when the server reports an in-flight progress, OR
  // the user just clicked the CTA, OR the lock dialog redirected.
  const isDrafting = pending || draftingFromUrl || (progress !== null && !progress.error);
  const errored = progress?.error ?? null;

  useEffect(() => {
    const supabase = createClient();
    const channelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`rt:trip-draft:${tripId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as {
            enriched_draft_generated_at?: string | null;
            meta?: TripMeta | null;
          };
          // Update progress UI from real server stage transitions.
          const nextProgress = next.meta?.draft_progress ?? null;
          setProgress(nextProgress);

          const nextAt = next.enriched_draft_generated_at ?? null;
          if (nextAt && nextAt !== initialDraftedAt) {
            if (searchParams.get("drafting")) {
              const url = new URL(window.location.href);
              url.searchParams.delete("drafting");
              window.history.replaceState({}, "", url.toString());
            }
            setDraftingFromUrl(false);
            router.refresh();
          }
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        router.refresh();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tripId, initialDraftedAt, router, searchParams]);

  const handleClick = () => {
    setUpgradeError(null);
    setProgress(null);
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

  if (errored) {
    return (
      <div className="border border-err/40 bg-err/[0.06] mb-10 px-7 py-8 grid gap-4">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-err" aria-hidden />
          <span className="label-sm text-err">Drafting failed</span>
        </div>
        <p className="text-[14px] text-fg-2 leading-[1.55] max-w-[560px]">
          {errored.message}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            tone="accent"
            size="md"
            onClick={handleClick}
            disabled={pending}
          >
            {pending ? "Retrying…" : "Retry draft"}
          </Button>
        </div>
      </div>
    );
  }

  if (isDrafting) {
    return (
      <DraftingProgress destination={destination} progress={progress} />
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
        plan.
      </p>

      <div className="flex items-center gap-6 flex-wrap">
        <Button tone="accent" size="lg" onClick={handleClick} disabled={pending}>
          Draft travel plan →
        </Button>
      </div>

      {upgradeError && (
        <div className="mt-6 border border-accent/30 bg-accent/[0.06] px-4 py-3 flex items-center gap-4 flex-wrap text-[13px]">
          <span className="text-fg-2">{upgradeError}</span>
          <Link
            href="/account"
            className="label-sm-wide text-accent hover:underline shrink-0"
          >
            Upgrade →
          </Link>
        </div>
      )}
    </div>
  );
}
