"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  updateTripDatesBudget,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/hooks/useToast";

const INPUT_CLASS =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full";

type Props = {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
  voteDeadline: string | null;
  targetBudgetPp: number | null;
  targetCrewSize: number | null;
};

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DatesBudgetSection({
  tripId,
  startDate,
  endDate,
  voteDeadline,
  targetBudgetPp,
  targetCrewSize,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateTripDatesBudget,
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

      <div className="grid grid-cols-2 max-[520px]:grid-cols-1 gap-4">
        <Field
          label="Start date"
          name="startDate"
          helper="Drives the T-minus counter."
        >
          <input
            type="date"
            defaultValue={startDate ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="End date" name="endDate">
          <input
            type="date"
            defaultValue={endDate ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field
        label="Vote deadline"
        name="voteDeadline"
        helper="Soft deadline shown on the Where to? tab. Not enforced."
      >
        <input
          type="datetime-local"
          defaultValue={isoToLocalInput(voteDeadline)}
          className={INPUT_CLASS}
        />
      </Field>

      <div className="grid grid-cols-2 max-[520px]:grid-cols-1 gap-4">
        <Field
          label="Target budget / head"
          name="targetBudgetPp"
          helper="In your kitty's currency. Blank to hide."
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1_000_000}
            step={1}
            defaultValue={targetBudgetPp ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Target crew size"
          name="targetCrewSize"
          helper="Soft target, used on the Crew tab placeholders."
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            step={1}
            defaultValue={targetCrewSize ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      {state?.error && (
        <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
          {state.error}
        </div>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save dates & budget"}
        </Button>
      </div>
    </form>
  );
}
