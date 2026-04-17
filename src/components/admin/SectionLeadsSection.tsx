"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  updateSectionLeads,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/hooks/useToast";
import type { SectionLeads } from "@/lib/types";
import { INPUT } from "@/lib/styles";

type Props = {
  tripId: string;
  leads: SectionLeads;
};

const FIELDS: Array<{
  name: keyof SectionLeads;
  label: string;
  helper: string;
  placeholder: string;
}> = [
  {
    name: "overview",
    label: "Overview",
    helper: "Under § 01 The brief.",
    placeholder: "Spec grid and schedule for the trip.",
  },
  {
    name: "shortlist",
    label: "Shortlist",
    helper: "Under § 03 Shortlist.",
    placeholder: "Vote yes, meh, or no. Ranked by consensus.",
  },
  {
    name: "bookings",
    label: "Bookings",
    helper: "Under § 04 Bookings.",
    placeholder: "Claim a row, tick when done.",
  },
  {
    name: "ledger",
    label: "Ledger",
    helper: "Under § 05 Ledger.",
    placeholder: "Log what you've paid. Splits auto-calculate.",
  },
  {
    name: "feed",
    label: "Feed",
    helper: "Under § 06 Feed.",
    placeholder: "Post photos and captions from the trip.",
  },
];

export function SectionLeadsSection({ tripId, leads }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateSectionLeads,
    undefined,
  );
  const toast = useToast();
  const lastOkRef = useRef<unknown>(null);

  useEffect(() => {
    if (state?.ok && lastOkRef.current !== state) {
      lastOkRef.current = state;
      toast.success("Saved.");
    }
  }, [state, toast]);

  return (
    <form action={action} className="grid gap-5 max-w-[560px]">
      <input type="hidden" name="tripId" value={tripId} />

      {FIELDS.map((f) => (
        <Field key={f.name} label={f.label} name={f.name} helper={f.helper}>
          <textarea
            defaultValue={leads[f.name] ?? ""}
            maxLength={300}
            rows={2}
            placeholder={f.placeholder}
            className={INPUT}
          />
        </Field>
      ))}

      {state?.error && (
        <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
          {state.error}
        </div>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save section leads"}
        </Button>
      </div>
    </form>
  );
}
