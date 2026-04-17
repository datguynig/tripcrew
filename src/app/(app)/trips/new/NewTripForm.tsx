"use client";

import { useActionState } from "react";
import { createTrip, type CreateTripState } from "@/lib/actions/trips";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

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
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full"
        />
      </Field>

      <div className="grid grid-cols-2 max-[520px]:grid-cols-1 gap-4">
        <Field
          label="Start date"
          name="startDate"
          helper="Optional, set later if unknown"
        >
          <input
            type="date"
            className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors w-full"
          />
        </Field>
        <Field label="End date" name="endDate">
          <input
            type="date"
            className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors w-full"
          />
        </Field>
      </div>

      <Field
        label="Destination candidates"
        name="candidates"
        helper="One per line. Skip if unsure — crew can propose later."
      >
        <textarea
          rows={5}
          placeholder={"Lisbon\nBudapest\nMedellín"}
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 min-h-[120px] leading-[1.5] resize-y w-full"
        />
      </Field>

      <Field
        label="Vote deadline"
        name="voteDeadline"
        helper="Optional soft deadline — shown to the crew, not enforced"
      >
        <input
          type="datetime-local"
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors w-full"
        />
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
