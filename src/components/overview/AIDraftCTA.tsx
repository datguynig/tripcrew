"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { draftTripAction } from "@/lib/actions/aiDraft";
import { AIDraftProgress } from "./AIDraftProgress";
import { AIDraftPreferences } from "./AIDraftPreferences";
import type { AiPreferences } from "@/lib/types";

/**
 * Primary post-lock CTA. Promoted to the top of "The brief" section
 * when a trip is locked + empty + the current user can use the beta.
 *
 * Click flow: CTA → preferences modal (captures origin, crew size,
 * budget, vibes) → AI call fires with that context. Preferences are
 * saved server-side so re-drafts skip the modal.
 */

type Props = {
  tripId: string;
  destination: string;
  tripSlug?: string;
  crewCount: number;
  currency: string;
  targetBudgetPp: number | null;
  existingPreferences?: AiPreferences | null;
};

export function AIDraftCTA({
  tripId,
  destination,
  tripSlug,
  crewCount,
  currency,
  targetBudgetPp,
  existingPreferences = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);

  const handleSubmitPrefs = (prefs: AiPreferences) => {
    setPrefsOpen(false);
    setProgressOpen(true);
    startTransition(async () => {
      const res = await draftTripAction({ tripId, preferences: prefs });
      setProgressOpen(false);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Drafted — ${res.counts?.activities ?? 0} activities, ${res.counts?.bookings ?? 0} bookings.`,
      );
      router.refresh();
    });
  };

  return (
    <>
      <div className="border border-accent/40 bg-accent/[0.04] mb-10 px-7 py-10 max-[640px]:px-5 max-[640px]:py-8">
        <div className="flex items-center gap-2 mb-5">
          <span
            className="w-[6px] h-[6px] rounded-full bg-accent brand-dot"
            aria-hidden="true"
          />
          <span className="label-sm text-accent">AI · Beta</span>
        </div>

        <h3 className="text-[40px] max-[640px]:text-[30px] font-medium tracking-[-0.03em] leading-[1.02] mb-5 max-w-[720px]">
          Draft {destination} in one click
          <span className="text-accent">.</span>
        </h3>

        <p className="text-fg-2 text-[15px] leading-[1.55] max-w-[600px] mb-8">
          Tell us a few details — origin, crew size, budget, vibe — and
          the AI drafts the hero, spec grid, schedule, activities and
          bookings grounded in real venues.
        </p>

        <div className="flex items-center gap-6 flex-wrap">
          <Button
            tone="accent"
            size="lg"
            onClick={() => setPrefsOpen(true)}
            disabled={pending}
          >
            {pending ? "Drafting…" : "Draft with AI →"}
          </Button>
          {tripSlug && (
            <Link
              href={`/trips/${tripSlug}/admin`}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 hover:text-fg transition-colors"
            >
              Or fill manually in admin →
            </Link>
          )}
        </div>
      </div>

      {prefsOpen && (
        <AIDraftPreferences
          destination={destination}
          defaultPreferences={existingPreferences}
          defaultCrewSize={crewCount}
          defaultCurrency={currency}
          defaultBudgetPp={targetBudgetPp}
          onCancel={() => setPrefsOpen(false)}
          onSubmit={handleSubmitPrefs}
        />
      )}

      {progressOpen && <AIDraftProgress destination={destination} />}
    </>
  );
}
