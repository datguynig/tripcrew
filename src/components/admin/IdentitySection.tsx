"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateTripIdentity,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DestinationSearch } from "@/components/destinations/DestinationSearch";
import { useToast } from "@/hooks/useToast";
import { INPUT } from "@/lib/styles";

type Props = {
  tripId: string;
  name: string;
  destination: string | null;
};

export function IdentitySection({ tripId, name, destination }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateTripIdentity,
    undefined,
  );
  const toast = useToast();
  const lastOkRef = useRef<unknown>(null);
  const [destinationValue, setDestinationValue] = useState(destination ?? "");

  useEffect(() => {
    if (state?.ok && lastOkRef.current !== state) {
      lastOkRef.current = state;
      toast.success("Saved.");
    }
  }, [state, toast]);

  return (
    <form action={action} className="grid gap-5 max-w-[560px]">
      <input type="hidden" name="tripId" value={tripId} />
      <Field
        label="Trip name"
        name="name"
        required
        helper="Shown on the topbar and dashboard. Renaming does not change the URL."
      >
        <input
          defaultValue={name}
          maxLength={80}
          className={INPUT}
        />
      </Field>
      <input type="hidden" name="destination" value={destinationValue} />
      <Field
        label="Destination"
        name="destination"
        helper={
          destination
            ? "The headline on the overview page."
            : "Set manually, or lock a candidate on the Where to? tab."
        }
      >
        <DestinationSearch
          value={destinationValue}
          onChange={setDestinationValue}
          placeholder="Lisbon"
          maxLength={80}
        />
      </Field>
      {state?.error && (
        <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
          {state.error}
        </div>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save identity"}
        </Button>
      </div>
    </form>
  );
}
