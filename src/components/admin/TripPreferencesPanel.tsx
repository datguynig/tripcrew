"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TripPreferencesForm } from "@/components/trips/TripPreferencesForm";
import { updateTripPreferences } from "@/lib/actions/tripPreferences";
import { useToast } from "@/hooks/useToast";
import type { AiPreferences } from "@/lib/types";

type Props = {
  tripId: string;
  initial: AiPreferences;
  defaultCurrency: string;
  tripDates: { start: string | null; end: string | null };
};

export function TripPreferencesPanel({
  tripId,
  initial,
  defaultCurrency,
  tripDates,
}: Props) {
  const [value, setValue] = useState<AiPreferences>(initial);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateTripPreferences({ tripId, preferences: value });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Preferences saved.");
    });
  };

  return (
    <div className="grid gap-6">
      <TripPreferencesForm
        value={value}
        onChange={setValue}
        defaultCurrency={defaultCurrency}
        tripDates={tripDates}
      />
      <div className="flex items-center gap-3 pt-2 border-t border-line">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3">
          Saved prefs become stale → regenerate the plan from the overview.
        </span>
      </div>
    </div>
  );
}
