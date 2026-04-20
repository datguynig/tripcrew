"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, formatDisplay } from "./Calendar";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function splitIso(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!iso) return { date: "", time: "" };
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return { date: "", time: "" };
  return {
    date: match[1],
    time: match[2] && match[3] ? `${match[2]}:${match[3]}` : "",
  };
}

type Props = {
  name: string;
  id?: string;
  defaultValue?: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
};

export function DateTimePicker({
  name,
  id,
  defaultValue,
  placeholder = "Pick a date & time",
  disabled,
  required,
}: Props) {
  const initial = splitIso(defaultValue);
  const [date, setDate] = useState(initial.date);
  const [hours, setHours] = useState(
    initial.time ? initial.time.slice(0, 2) : "18",
  );
  const [minutes, setMinutes] = useState(
    initial.time ? initial.time.slice(3, 5) : "00",
  );
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

  const combined = date ? `${date}T${hours}:${minutes}` : "";
  const displayText = date
    ? `${formatDisplay(date)} · ${hours}:${minutes}`
    : placeholder;
  const isEmpty = !date;

  const onHours = (raw: string) => {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(23, Math.max(0, n));
    setHours(pad(clamped));
  };
  const onMinutes = (raw: string) => {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    const clamped = Math.min(59, Math.max(0, n));
    setMinutes(pad(clamped));
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="hidden"
        name={name}
        value={combined}
        required={required}
        suppressHydrationWarning
      />
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md hover:border-line-2 focus:border-line-2 outline-none transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default ${
          isEmpty ? "text-fg-3" : "text-fg"
        }`}
      >
        <span className="truncate" suppressHydrationWarning>
          {displayText}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="w-4 h-4 text-fg-2 shrink-0"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M8 4.5V8L10.5 9.5"
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
          className="absolute left-0 top-[calc(100%+6px)] z-50 bg-bg-2 border border-line rounded-md shadow-lg p-3"
        >
          <Calendar
            value={date || null}
            onSelect={(picked) => setDate(picked)}
            onClear={() => {
              setDate("");
              setOpen(false);
            }}
          />
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
            <span className="label-sm text-fg-3">
              Time
            </span>
            <input
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(e) => onHours(e.target.value)}
              disabled={!date}
              aria-label="Hours"
              className="bg-bg-3 border border-line w-14 text-center py-[6px] text-[13px] font-mono tabular rounded focus:border-line-2 outline-none disabled:opacity-50"
            />
            <span className="text-fg-3">:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              value={minutes}
              onChange={(e) => onMinutes(e.target.value)}
              disabled={!date}
              aria-label="Minutes"
              className="bg-bg-3 border border-line w-14 text-center py-[6px] text-[13px] font-mono tabular rounded focus:border-line-2 outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={!date}
              className="ml-auto font-mono text-[10px] tracking-[0.12em] uppercase text-accent hover:text-fg cursor-pointer disabled:opacity-50 disabled:cursor-default"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
