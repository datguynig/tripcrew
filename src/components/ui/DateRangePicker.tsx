"use client";

import { useEffect, useRef, useState } from "react";
import { INPUT_TRIGGER } from "@/lib/styles";
import { formatDisplay } from "./Calendar";
import { RangeCalendar } from "./RangeCalendar";

/**
 * Single-field date range picker. Replaces the pair of DatePickers
 * for trip dates. Opens a dual-month calendar with range selection,
 * hover preview, and month pagination. Emits two hidden inputs so
 * existing form-action plumbing reads startDate + endDate unchanged.
 */

type Props = {
  startName?: string;
  endName?: string;
  defaultStart?: string | null;
  defaultEnd?: string | null;
  minDate?: string | null;
  maxDate?: string | null;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (next: { start: string | null; end: string | null }) => void;
};

export function DateRangePicker({
  startName = "startDate",
  endName = "endDate",
  defaultStart = null,
  defaultEnd = null,
  minDate,
  maxDate,
  placeholder = "Pick dates",
  disabled,
  onChange,
}: Props) {
  const [start, setStart] = useState<string>(defaultStart ?? "");
  const [end, setEnd] = useState<string>(defaultEnd ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleChange = (next: { start: string | null; end: string | null }) => {
    setStart(next.start ?? "");
    setEnd(next.end ?? "");
    onChange?.(next);
    // Auto-close when the range is complete.
    if (next.start && next.end) setOpen(false);
  };

  const label = (() => {
    if (start && end) return `${formatDisplay(start)} → ${formatDisplay(end)}`;
    if (start) return `${formatDisplay(start)} → pick end`;
    return placeholder;
  })();

  const isEmpty = !start && !end;

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={startName} value={start} />
      <input type="hidden" name={endName} value={end} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${INPUT_TRIGGER} ${isEmpty ? "text-fg-3" : "text-fg"}`}
      >
        <span className="truncate tabular">{label}</span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="w-4 h-4 text-fg-2 shrink-0"
        >
          <rect
            x="2"
            y="3.5"
            width="12"
            height="10.5"
            rx="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M5 1.5V4 M11 1.5V4 M2 7H14"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pick trip dates"
          className="absolute left-0 top-[calc(100%+6px)] z-50 bg-bg-2 border border-line rounded-md shadow-lg p-4"
        >
          <RangeCalendar
            start={start || null}
            end={end || null}
            onChange={handleChange}
            minDate={minDate}
            maxDate={maxDate}
          />
        </div>
      )}
    </div>
  );
}
