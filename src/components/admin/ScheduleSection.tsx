"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateSchedule,
  type ActionState,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import type { ScheduleItem } from "@/lib/types";

const INPUT_CLASS =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full";
const MONO_INPUT_CLASS =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-[13px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full font-mono tracking-[0.05em] uppercase";

type Props = {
  tripId: string;
  schedule: ScheduleItem[];
};

const MAX_ROWS = 20;

export function ScheduleSection({ tripId, schedule }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateSchedule,
    undefined,
  );
  const toast = useToast();
  const lastOkRef = useRef<unknown>(null);
  const [rows, setRows] = useState<ScheduleItem[]>(
    schedule.length > 0
      ? schedule
      : [{ day_label: "", heading: "", body: "" }],
  );

  useEffect(() => {
    if (state?.ok && lastOkRef.current !== state) {
      lastOkRef.current = state;
      toast.success("Saved.");
    }
  }, [state, toast]);

  const setRow = (i: number, patch: Partial<ScheduleItem>) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );

  const addRow = () =>
    setRows((prev) =>
      prev.length >= MAX_ROWS
        ? prev
        : [...prev, { day_label: "", heading: "", body: "" }],
    );

  const removeRow = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    setRows((prev) => {
      const next = i + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      [copy[i], copy[next]] = [copy[next], copy[i]];
      return copy;
    });
  };

  return (
    <form action={action} className="grid gap-5 max-w-[720px]">
      <input type="hidden" name="tripId" value={tripId} />
      <input
        type="hidden"
        name="schedule"
        value={JSON.stringify(
          rows.filter((r) => r.day_label || r.heading || r.body),
        )}
      />

      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13px] text-fg-3 max-w-[520px]">
          Day-by-day plan. Day label is mono caps. Add, remove, or reorder rows.
        </p>
        <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3 shrink-0">
          {rows.length} / {MAX_ROWS}
        </span>
      </div>

      <div className="grid gap-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid gap-3 border border-line p-4 rounded-md"
          >
            <div className="grid grid-cols-[140px_1fr_auto] max-[520px]:grid-cols-1 gap-3 items-start">
              <input
                value={row.day_label}
                onChange={(e) =>
                  setRow(i, { day_label: e.target.value.toUpperCase() })
                }
                maxLength={30}
                placeholder="THU 23 JUL"
                aria-label={`Day label for row ${i + 1}`}
                className={MONO_INPUT_CLASS}
              />
              <input
                value={row.heading}
                onChange={(e) => setRow(i, { heading: e.target.value })}
                maxLength={120}
                placeholder="Arrivals & anchor dinner"
                aria-label={`Heading for row ${i + 1}`}
                className={INPUT_CLASS}
              />
              <div className="flex gap-1 max-[520px]:justify-self-start">
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move row ${i + 1} up`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={`Move row ${i + 1} down`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  onClick={() => removeRow(i)}
                  aria-label={`Remove row ${i + 1}`}
                  className="hover:text-err"
                >
                  ✕
                </Button>
              </div>
            </div>
            <textarea
              value={row.body}
              onChange={(e) => setRow(i, { body: e.target.value })}
              maxLength={500}
              rows={2}
              placeholder="Everyone lands before 18:00. Drop bags, walk to Cervejaria Ramiro, leave space for prego."
              aria-label={`Body for row ${i + 1}`}
              className={INPUT_CLASS}
            />
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
          + Add day
        </Button>
      </div>

      {state?.error && (
        <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
          {state.error}
        </div>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </form>
  );
}
