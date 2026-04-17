"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  updateTripIdentity,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/hooks/useToast";

const INPUT_CLASS =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full";

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
          className={INPUT_CLASS}
        />
      </Field>
      <Field
        label="Destination"
        name="destination"
        helper={
          destination
            ? "The headline on the overview page."
            : "Set manually, or lock a candidate on the Where to? tab."
        }
      >
        <input
          defaultValue={destination ?? ""}
          maxLength={80}
          placeholder="Lisbon"
          className={INPUT_CLASS}
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
