"use client";

import { useEffect, useRef, useState } from "react";
import { INPUT_TRIGGER } from "@/lib/styles";
import { Calendar, formatDisplay } from "./Calendar";

type Props = {
  name: string;
  id?: string;
  defaultValue?: string | null;
  value?: string | null;
  onChange?: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

export function DatePicker({
  name,
  id,
  defaultValue,
  value: controlledValue,
  onChange,
  placeholder = "Pick a date",
  disabled,
  minDate,
  maxDate,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  required,
}: Props) {
  const isControlled = controlledValue !== undefined;
  const [internalIso, setInternalIso] = useState<string>(defaultValue ?? "");
  const iso = isControlled ? (controlledValue ?? "") : internalIso;
  const setIso = (next: string) => {
    if (!isControlled) setInternalIso(next);
    onChange?.(next);
  };
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

  const displayText = iso ? formatDisplay(iso) : placeholder;
  const isEmpty = !iso;

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={iso} required={required} />
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className={`${INPUT_TRIGGER} ${isEmpty ? "text-fg-3" : "text-fg"}`}
      >
        <span className="truncate">{displayText}</span>
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
          className="absolute left-0 top-[calc(100%+6px)] z-50 bg-bg-2 border border-line rounded-md shadow-lg p-3"
        >
          <Calendar
            value={iso || null}
            onSelect={(picked) => {
              setIso(picked);
              setOpen(false);
            }}
            onClear={() => {
              setIso("");
              setOpen(false);
            }}
            minDate={minDate}
            maxDate={maxDate}
          />
        </div>
      )}
    </div>
  );
}
