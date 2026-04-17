"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteTrip,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/hooks/useToast";
import { INPUT } from "@/lib/styles";

type Props = {
  tripId: string;
  tripName: string;
};

export function DangerZone({ tripId, tripName }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteTrip,
    undefined,
  );
  const toast = useToast();
  const lastErrRef = useRef<string | null>(null);
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    if (state?.error && state.error !== lastErrRef.current) {
      lastErrRef.current = state.error;
      toast.error(state.error);
    }
  }, [state, toast]);

  const matches = confirmName.trim() === tripName.trim();

  return (
    <div className="border border-err/30 bg-err/5 rounded-md p-5">
      <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-err mb-2">
        Danger zone
      </div>
      <p className="text-fg-2 text-[14px] mb-4 max-w-[560px]">
        Delete this trip permanently. All members lose access; activities,
        votes, bookings, expenses, and posts are wiped. This cannot be undone.
      </p>
      <form action={action} className="grid gap-3 max-w-[440px]">
        <input type="hidden" name="tripId" value={tripId} />
        <Field
          label={`Type "${tripName}" to confirm`}
          name="confirmName"
        >
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={tripName}
            className={INPUT}
            autoComplete="off"
          />
        </Field>
        <div>
          <Button
            type="submit"
            variant="destructive"
            tone="accent"
            disabled={pending || !matches}
          >
            {pending ? "Deleting…" : "Delete trip"}
          </Button>
        </div>
      </form>
    </div>
  );
}
