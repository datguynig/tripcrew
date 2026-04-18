"use client";

import { useActionState } from "react";
import { createTrip, type CreateTripState } from "@/lib/actions/trips";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { INPUT, INPUT_SM } from "@/lib/styles";

export function NewTripForm() {
  const [state, action, pending] = useActionState<CreateTripState, FormData>(
    createTrip,
    undefined,
  );

  return (
    <form action={action} className="grid gap-6 max-w-[560px]">
      <Field
        label="Trip name"
        name="name"
        required
        helper="E.g. 'Summer 2026 crew'"
      >
        <input
          autoFocus
          maxLength={80}
          placeholder="What are you calling it?"
          className={INPUT}
        />
      </Field>

      <Field
        label="Start date"
        name="startDate"
        helper="Optional, set later if unknown"
      >
        <DatePicker name="startDate" />
      </Field>
      <Field label="End date" name="endDate">
        <DatePicker name="endDate" />
      </Field>

      <Field
        label="Destination candidates"
        name="candidates"
        helper="One per line. Skip if unsure — crew can propose later."
      >
        <textarea
          rows={5}
          placeholder={"Lisbon\nBudapest\nMedellín"}
          className={`${INPUT_SM} min-h-[120px] leading-[1.5] resize-y`}
        />
      </Field>

      <Field
        label="Vote deadline"
        name="voteDeadline"
        helper="Optional soft deadline — shown to the crew, not enforced"
      >
        <DateTimePicker name="voteDeadline" />
      </Field>

      {state?.error && (
        <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create trip"}
        </Button>
      </div>
    </form>
  );
}
