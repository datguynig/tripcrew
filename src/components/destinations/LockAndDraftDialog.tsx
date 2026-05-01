"use client";

import { useState, useTransition } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { TripPreferencesForm } from "@/components/trips/TripPreferencesForm";
import { lockAndStartDraft } from "@/lib/actions/destinations";
import { sanitizeVibes } from "@/lib/ai/vibeMap";
import { useRouter } from "next/navigation";
import type { AiPreferences, AiOccasion } from "@/lib/types";

/**
 * Multi-step dialog that turns "Lock destination" into a real moment.
 * Three sections, all in one scrollable surface:
 *
 *   A. Confirm the lock — names the winner, notes the irreversibility
 *   B. Tell the AI about your trip — origin, budget, vibes, occasion,
 *      notes, pinned moments (the rich context that powers all AI on
 *      this trip from now on)
 *   C. What happens next — primary "Lock & start drafting →" button
 *      kicks off the atomic action; secondary link locks without
 *      drafting for admins who want to fill manually.
 *
 * The dialog never persists prefs unless admin clicks one of the
 * primary buttons. Cancel discards.
 */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  destination: string; // winner.title
  defaultPreferences: AiPreferences | null;
  defaultCrewSize: number;
  defaultCurrency: string;
  defaultBudgetPp: number | null;
  defaultOccasion: AiOccasion | undefined;
  tripDates: { start: string | null; end: string | null };
};

function initialPrefs(
  existing: AiPreferences | null,
  defaultCrewSize: number,
  defaultBudgetPp: number | null,
  defaultOccasion: AiOccasion | undefined,
): AiPreferences {
  if (existing) {
    return { ...existing, vibes: sanitizeVibes(existing.vibes) };
  }
  return {
    origin: null,
    crew_size: Math.max(1, defaultCrewSize),
    budget_tier: defaultBudgetPp ? "custom" : "mid",
    budget_custom_pp: defaultBudgetPp,
    vibes: [],
    occasion: defaultOccasion,
    notes: undefined,
    pins: [],
  };
}

export function LockAndDraftDialog({
  open,
  onOpenChange,
  tripId,
  destination,
  defaultPreferences,
  defaultCrewSize,
  defaultCurrency,
  defaultBudgetPp,
  defaultOccasion,
  tripDates,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState<AiPreferences>(() =>
    initialPrefs(
      defaultPreferences,
      defaultCrewSize,
      defaultBudgetPp,
      defaultOccasion,
    ),
  );

  const submit = (autoDraft: boolean) => {
    startTransition(async () => {
      const result = await lockAndStartDraft({
        tripId,
        preferences: prefs,
        autoDraft,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not lock the trip.");
        return;
      }
      onOpenChange(false);
      if (autoDraft) {
        toast.success("Drafting your trip. The page updates as it lands.");
      } else {
        toast.success("Locked. You can draft any time from the trip page.");
      }
      if (result.slug) {
        const target = autoDraft
          ? `/trips/${result.slug}?drafting=1`
          : `/trips/${result.slug}`;
        router.push(target);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-bg/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out z-40" />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100vw-24px))] max-h-[calc(100vh-48px)] overflow-y-auto bg-bg-2 border border-line-2 rounded-md z-50 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out"
          aria-describedby={undefined}
        >
          <header className="flex items-center justify-between px-7 py-5 border-b border-line sticky top-0 bg-bg-2 z-10">
            <div className="flex items-center gap-2">
              <span
                className="w-[6px] h-[6px] rounded-full bg-accent brand-dot"
                aria-hidden="true"
              />
              <span className="label-sm text-accent">Lock &amp; draft</span>
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="text-fg-3 hover:text-fg text-[16px] cursor-pointer"
            >
              ✕
            </RadixDialog.Close>
          </header>

          <div className="px-7 py-7 grid gap-10">
            {/* A. Confirm */}
            <section className="grid gap-2">
              <RadixDialog.Title className="text-[24px] font-medium tracking-[-0.02em]">
                Lock {destination}
                <span className="text-accent">.</span>
              </RadixDialog.Title>
              <p className="text-fg-2 text-[14px] leading-[1.55]">
                The crew can no longer change the destination after you lock.
                You can still unlock from the trip page.
              </p>
            </section>

            {/* B. Trip preferences */}
            <section className="grid gap-3">
              <h3 className="text-[16px] font-medium tracking-[-0.015em]">
                Tell the AI about your trip
              </h3>
              <p className="text-fg-3 text-[13px] leading-[1.55]">
                All optional, but the more you fill in the better the plan
                fits the crew. Editable later via /admin.
              </p>
              <TripPreferencesForm
                value={prefs}
                onChange={setPrefs}
                defaultCurrency={defaultCurrency}
                tripDates={tripDates}
              />
            </section>
          </div>

          {/* C. What happens next */}
          <footer className="flex items-center justify-end gap-3 px-7 py-5 border-t border-line sticky bottom-0 bg-bg-2 flex-wrap">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={pending}
              className="text-fg-3 hover:text-fg text-[13px] underline-offset-2 hover:underline cursor-pointer transition-colors"
            >
              Lock without drafting
            </button>
            <Button
              tone="accent"
              onClick={() => submit(true)}
              disabled={pending}
            >
              {pending ? "Locking…" : "Lock & start drafting →"}
            </Button>
          </footer>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
