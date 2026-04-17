"use client";

import { useActionState } from "react";
import { createTrip, type CreateTripState } from "@/lib/actions/trips";

export function NewTripForm() {
  const [state, action, pending] = useActionState<CreateTripState, FormData>(
    createTrip,
    undefined,
  );

  return (
    <form action={action} className="grid gap-6 max-w-[560px]">
      <Field label="Trip name" required hint="E.g. 'Summer 2026 crew'">
        <input
          name="name"
          required
          autoFocus
          maxLength={80}
          placeholder="What are you calling it?"
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full"
        />
      </Field>

      <div className="grid grid-cols-2 max-[520px]:grid-cols-1 gap-4">
        <Field label="Start date" hint="Optional, set later if unknown">
          <input
            name="startDate"
            type="date"
            className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors w-full"
          />
        </Field>
        <Field label="End date">
          <input
            name="endDate"
            type="date"
            className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors w-full"
          />
        </Field>
      </div>

      <Field
        label="Destination candidates"
        hint="One per line. Skip if unsure — crew can propose later."
      >
        <textarea
          name="candidates"
          rows={5}
          placeholder={"Lisbon\nBudapest\nMedellín"}
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 min-h-[120px] leading-[1.5] resize-y w-full"
        />
      </Field>

      <Field
        label="Vote deadline"
        hint="Optional soft deadline — shown to the crew, not enforced"
      >
        <input
          name="voteDeadline"
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
        <button
          type="submit"
          disabled={pending}
          className="bg-fg text-bg px-[22px] py-[12px] text-[13px] font-medium rounded-md hover:bg-accent transition-colors cursor-pointer disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create trip"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="text-[12px] text-fg-3">{hint}</span>}
    </label>
  );
}
