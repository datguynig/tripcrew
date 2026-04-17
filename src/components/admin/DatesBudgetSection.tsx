"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  updateTripDatesBudget,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useToast } from "@/hooks/useToast";
import { INPUT } from "@/lib/styles";

type Props = {
  tripId: string;
  startDate: string | null;
  endDate: string | null;
  voteDeadline: string | null;
  targetBudgetPp: number | null;
  targetCrewSize: number | null;
  currency: string | null;
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
  currency,
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

      <Field
        label="Start date"
        name="startDate"
        helper="Drives the T-minus counter."
      >
        <DatePicker name="startDate" defaultValue={startDate} />
      </Field>

      <Field label="End date" name="endDate">
        <DatePicker name="endDate" defaultValue={endDate} />
      </Field>

      <Field
        label="Vote deadline"
        name="voteDeadline"
        helper="Soft deadline shown on the Where to? tab. Not enforced."
      >
        <DateTimePicker
          name="voteDeadline"
          defaultValue={isoToLocalInput(voteDeadline) || null}
        />
      </Field>

      <Field
        label="Target budget / head"
        name="targetBudgetPp"
        helper="Drives the kitty math. Blank to hide the stat."
      >
        <MoneyInput
          amountName="targetBudgetPp"
          currencyName="currency"
          defaultAmount={targetBudgetPp}
          defaultCurrency={currency}
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
          className={INPUT}
        />
      </Field>

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
