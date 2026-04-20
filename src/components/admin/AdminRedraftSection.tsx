"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { draftTripAction } from "@/lib/actions/aiDraft";
import { AIDraftProgress } from "@/components/overview/AIDraftProgress";
import { AIDraftPreferences } from "@/components/overview/AIDraftPreferences";
import type { AiPreferences } from "@/lib/types";

/**
 * Admin-page "nuclear" redraft. Uses the same AIDraftPreferences
 * modal as the first draft (seeded with the trip's saved prefs) and
 * fires draftTripAction with force=true — wiping AI-drafted activities
 * and bookings, re-writing hero + spec + schedule.
 *
 * Destructive by design: this is for "the trip changed, start over".
 * Section redraft + per-row reroll + feedback "Try again" cover the
 * 90% case on Overview — this is the 10%.
 */

type Props = {
  tripId: string;
  destination: string;
  crewCount: number;
  currency: string;
  targetBudgetPp: number | null;
  existingPreferences: AiPreferences | null;
  lastDraftedAt: string | null;
  canRedraft: boolean;
  blockedReason: string | null;
};

export function AdminRedraftSection({
  tripId,
  destination,
  crewCount,
  currency,
  targetBudgetPp,
  existingPreferences,
  lastDraftedAt,
  canRedraft,
  blockedReason,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [progress, setProgress] = useState(false);

  const handleSubmit = (prefs: AiPreferences) => {
    setPrefsOpen(false);
    setProgress(true);
    startTransition(async () => {
      const res = await draftTripAction({
        tripId,
        force: true,
        preferences: prefs,
      });
      setProgress(false);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Redrafted — ${res.counts?.activities ?? 0} activities, ${res.counts?.bookings ?? 0} bookings.`,
      );
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-6 flex-wrap border border-line p-5">
        <div>
          <div className="label-sm-wide text-fg-3 mb-1">Last drafted</div>
          <div className="font-mono text-[13px] tracking-[0.08em] uppercase text-fg tabular">
            {lastDraftedAt ? relTime(lastDraftedAt) : "Never"}
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setPrefsOpen(true)}
          disabled={pending || !canRedraft}
          title={!canRedraft ? blockedReason ?? undefined : undefined}
        >
          {pending ? "Redrafting…" : "Redraft everything"}
        </Button>
      </div>

      {prefsOpen && (
        <AIDraftPreferences
          destination={destination}
          defaultPreferences={existingPreferences}
          defaultCrewSize={crewCount}
          defaultCurrency={currency}
          defaultBudgetPp={targetBudgetPp}
          onCancel={() => setPrefsOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {progress && <AIDraftProgress destination={destination} />}
    </>
  );
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}
