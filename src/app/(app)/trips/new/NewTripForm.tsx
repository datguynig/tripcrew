"use client";

import { useActionState } from "react";
import { createTrip, type CreateTripState } from "@/lib/actions/trips";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select, type SelectOption } from "@/components/ui/Select";
import { CandidatesEditor } from "@/components/trips/CandidatesEditor";
import { INPUT } from "@/lib/styles";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { OCCASION_LABELS, type AiOccasion } from "@/lib/types";

const OCCASION_ORDER: AiOccasion[] = [
  "group_holiday",
  "guys_trip",
  "girls_trip",
  "couples_trip",
  "birthday",
  "anniversary",
  "honeymoon",
  "babymoon",
  "engagement",
  "hen_do",
  "stag_do",
  "family",
  "graduation",
  "reunion",
  "corporate_retreat",
];

const OCCASION_OPTIONS: SelectOption<AiOccasion>[] = OCCASION_ORDER.map((o) => ({
  value: o,
  label: OCCASION_LABELS[o],
}));

const CURRENCY_OPTIONS: SelectOption<CurrencyCode>[] = CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.symbol}  ${c.code} · ${c.label}`,
}));

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
        label="Occasion"
        name="occasion"
        helper="Sets the tone for the AI from day one. Editable later."
      >
        <Select<AiOccasion>
          name="occasion"
          options={OCCASION_OPTIONS}
          placeholder="Pick one (optional)"
        />
      </Field>

      <Field
        label="Trip dates"
        name="startDate"
        helper="Optional, set later if unknown"
      >
        <DateRangePicker />
      </Field>

      <Field
        label="Currency"
        name="currency"
        helper="Used for budgets, the kitty, and the ledger. Editable in /admin."
      >
        <Select<CurrencyCode>
          name="currency"
          options={CURRENCY_OPTIONS}
          defaultValue="GBP"
          placeholder="Pick a currency"
        />
      </Field>

      <Field
        label="Destination candidates"
        name="candidates"
        helper="Pick from real places. Skip if unsure — crew can propose later."
      >
        <CandidatesEditor />
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
