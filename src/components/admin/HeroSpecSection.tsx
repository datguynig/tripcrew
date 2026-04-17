"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateHeroSpec,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/hooks/useToast";
import type { SpecItem } from "@/lib/types";

const INPUT_CLASS =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full";
const MONO_INPUT_CLASS =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[13px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full font-mono tracking-[0.05em] uppercase";

type Props = {
  tripId: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  cityLabel: string | null;
  datesLabel: string | null;
  specGrid: SpecItem[];
};

const MAX_ROWS = 4;

export function HeroSpecSection({
  tripId,
  heroTitle,
  heroSubtitle,
  cityLabel,
  datesLabel,
  specGrid,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateHeroSpec,
    undefined,
  );
  const toast = useToast();
  const lastOkRef = useRef<unknown>(null);
  const [rows, setRows] = useState<SpecItem[]>(
    specGrid.length > 0 ? specGrid : [{ label: "", value: "", sub: "" }],
  );

  useEffect(() => {
    if (state?.ok && lastOkRef.current !== state) {
      lastOkRef.current = state;
      toast.success("Saved.");
    }
  }, [state, toast]);

  const setRow = (i: number, patch: Partial<SpecItem>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) =>
      prev.length >= MAX_ROWS
        ? prev
        : [...prev, { label: "", value: "", sub: "" }],
    );

  const removeRow = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <form action={action} className="grid gap-5 max-w-[720px]">
      <input type="hidden" name="tripId" value={tripId} />
      <input
        type="hidden"
        name="specGrid"
        value={JSON.stringify(rows.filter((r) => r.label || r.value || r.sub))}
      />

      <Field
        label="Hero title"
        name="heroTitle"
        helper="Falls back to destination, then trip name."
      >
        <input
          defaultValue={heroTitle ?? ""}
          maxLength={80}
          placeholder="Lisbon"
          className={INPUT_CLASS}
        />
      </Field>

      <Field
        label="Hero subtitle"
        name="heroSubtitle"
        helper="One-line intro below the title."
      >
        <textarea
          defaultValue={heroSubtitle ?? ""}
          maxLength={300}
          rows={2}
          placeholder="Four days · six of us · one rule: no dramas."
          className={INPUT_CLASS}
        />
      </Field>

      <div className="grid grid-cols-2 max-[520px]:grid-cols-1 gap-4">
        <Field
          label="City label"
          name="cityLabel"
          helper="Mono caps, shown in the hero meta line."
        >
          <input
            defaultValue={cityLabel ?? ""}
            maxLength={40}
            placeholder="LISBON, PT"
            className={MONO_INPUT_CLASS}
          />
        </Field>
        <Field
          label="Dates label"
          name="datesLabel"
          helper="Overrides the auto-formatted date range."
        >
          <input
            defaultValue={datesLabel ?? ""}
            maxLength={40}
            placeholder="04 JUL – 08 JUL '26"
            className={MONO_INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="grid gap-3 border-t border-line pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-1">
              Spec grid
            </div>
            <p className="text-[13px] text-fg-3">
              Up to 4 cells. Label is mono caps, value is the headline, sub is
              the small print.
            </p>
          </div>
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3 shrink-0">
            {rows.length} / {MAX_ROWS}
          </span>
        </div>

        <div className="grid gap-3">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[140px_1fr_1fr_36px] max-[720px]:grid-cols-1 gap-3 items-start border border-line p-4 rounded-md"
            >
              <input
                value={row.label}
                onChange={(e) =>
                  setRow(i, { label: e.target.value.toUpperCase() })
                }
                maxLength={30}
                placeholder="BASE"
                aria-label={`Spec row ${i + 1} label`}
                className={MONO_INPUT_CLASS}
              />
              <input
                value={row.value}
                onChange={(e) => setRow(i, { value: e.target.value })}
                maxLength={80}
                placeholder="London → Lisbon"
                aria-label={`Spec row ${i + 1} value`}
                className={INPUT_CLASS}
              />
              <input
                value={row.sub}
                onChange={(e) => setRow(i, { sub: e.target.value })}
                maxLength={60}
                placeholder="4 DAYS · PEAK SUMMER"
                aria-label={`Spec row ${i + 1} sub`}
                className={INPUT_CLASS}
              />
              <Button
                type="button"
                variant="icon"
                onClick={() => removeRow(i)}
                aria-label={`Remove spec row ${i + 1}`}
                className="hover:text-err"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>

        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= MAX_ROWS}
          >
            + Add cell
          </Button>
        </div>
      </div>

      {state?.error && (
        <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
          {state.error}
        </div>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save hero & spec"}
        </Button>
      </div>
    </form>
  );
}
