"use client";

import { INPUT_SM } from "@/lib/styles";
import type { Schedule } from "@/lib/types";

type Props = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  value: Schedule;
  onChange: (next: Schedule) => void;
  tripEndDate: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthlyInstallments(
  count: number,
  endDate: string | null,
): { due_date: string; fraction: number }[] {
  if (count <= 0) return [];
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();
  const out: { due_date: string; fraction: number }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(end);
    d.setUTCMonth(d.getUTCMonth() - (count - 1 - i));
    out.push({
      due_date: d.toISOString().slice(0, 10),
      fraction:
        i === count - 1
          ? Math.round((1 - (1 / count) * (count - 1)) * 10000) / 10000
          : Math.round((1 / count) * 10000) / 10000,
    });
  }
  return out;
}

export function SchedulePaybackSection({
  enabled,
  onToggle,
  value,
  onChange,
  tripEndDate,
}: Props) {
  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => {
          onToggle(true);
          onChange({ type: "single", due_date: tripEndDate ?? todayIso() });
        }}
        className="label-sm text-fg-3 hover:text-accent transition-colors"
      >
        + Schedule payback over time
      </button>
    );
  }

  const setMode = (mode: "single" | "installments") => {
    if (mode === "single") {
      onChange({ type: "single", due_date: tripEndDate ?? todayIso() });
    } else {
      onChange({ type: "installments", installments: monthlyInstallments(3, tripEndDate) });
    }
  };

  return (
    <div className="border border-line bg-bg-2 p-4 grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-sm-wide text-fg-3">SCHEDULE PAYBACK</div>
        <button
          type="button"
          onClick={() => {
            onChange({ type: "none" });
            onToggle(false);
          }}
          className="label-sm text-fg-3 hover:text-fg transition-colors"
        >
          Remove schedule
        </button>
      </div>

      <div className="flex gap-1">
        {(["single", "installments"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMode(mode)}
            className={`label-sm px-2 py-1 border ${
              value.type === mode
                ? "border-accent text-accent"
                : "border-line text-fg-3 hover:border-line-2 hover:text-fg"
            } transition-colors`}
          >
            {mode === "single" ? "single date" : "installments"}
          </button>
        ))}
      </div>

      {value.type === "single" && (
        <input
          type="date"
          value={value.due_date}
          onChange={(e) => onChange({ type: "single", due_date: e.target.value })}
          className={INPUT_SM}
          aria-label="Due date"
        />
      )}

      {value.type === "installments" && (
        <>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-fg-3">Split into</span>
            <input
              type="number"
              min={2}
              max={12}
              value={value.installments.length}
              onChange={(e) =>
                onChange({
                  type: "installments",
                  installments: monthlyInstallments(
                    Math.max(2, Number(e.target.value)),
                    tripEndDate,
                  ),
                })
              }
              className={`${INPUT_SM} w-16`}
              aria-label="Number of installments"
            />
            <span className="text-fg-3">monthly until trip</span>
          </label>
          <div className="grid gap-1.5">
            {value.installments.map((inst, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_80px] gap-2 items-center text-[12px]"
              >
                <input
                  type="date"
                  value={inst.due_date}
                  onChange={(e) => {
                    if (value.type !== "installments") return;
                    const next = value.installments.slice();
                    next[idx] = { ...next[idx], due_date: e.target.value };
                    onChange({ type: "installments", installments: next });
                  }}
                  className={INPUT_SM}
                  aria-label={`Installment ${idx + 1} date`}
                />
                <span className="font-mono text-[11px] text-fg-3 text-right">
                  {(inst.fraction * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
