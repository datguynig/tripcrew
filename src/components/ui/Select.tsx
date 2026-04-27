"use client";

import { useEffect, useRef, useState } from "react";
import { INPUT_TRIGGER } from "@/lib/styles";

/**
 * Custom Select primitive — matches the editorial-brutalist look of
 * DatePicker/DateRangePicker (button trigger + popover), avoiding the
 * native macOS `<select>` chrome. Renders a hidden `<input type="hidden">`
 * so it works in plain `<form action={...}>` flows (e.g. NewTripForm
 * which uses useActionState + FormData).
 *
 * Controlled by default (value + onChange). When neither is provided,
 * falls back to internal state seeded by `defaultValue`.
 */

export type SelectOption<V extends string = string> = {
  value: V;
  label: string;
};

type Props<V extends string = string> = {
  name?: string;
  options: SelectOption<V>[];
  value?: V | "";
  defaultValue?: V | "";
  onChange?: (value: V | "") => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

export function Select<V extends string = string>({
  name,
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "Pick one",
  disabled,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  required,
}: Props<V>) {
  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = useState<V | "">(
    (defaultValue as V | "") ?? "",
  );
  const value = isControlled ? (controlledValue ?? "") : internal;
  const setValue = (next: V | "") => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Seed highlight from current value when opening, so keyboard nav
  // starts where the user left off.
  useEffect(() => {
    if (!open) {
      setHighlight(-1);
      return;
    }
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  const handleTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleListKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) {
        setValue(opt.value);
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
  };

  const selected = options.find((o) => o.value === value) ?? null;
  const displayText = selected?.label ?? placeholder;
  const isEmpty = !selected;

  return (
    <div ref={containerRef} className="relative">
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        disabled={disabled}
        aria-haspopup="listbox"
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
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKey}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-bg-2 border border-line rounded-md shadow-lg py-1 max-h-[280px] overflow-y-auto"
        >
          {options.map((opt, i) => {
            const active = opt.value === value;
            const highlighted = i === highlight;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  setValue(opt.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className={`w-full flex items-center gap-3 px-4 py-[10px] text-[14px] text-left transition-colors cursor-pointer ${
                  highlighted
                    ? "bg-bg-3 text-fg"
                    : active
                      ? "text-fg"
                      : "text-fg-2 hover:bg-bg-3 hover:text-fg"
                }`}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {active && (
                  <span aria-hidden className="text-accent text-[12px]">
                    ●
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
