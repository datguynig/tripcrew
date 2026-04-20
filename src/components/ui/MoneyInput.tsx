"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CURRENCIES, currencySymbol } from "@/lib/currency";

function formatAmount(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("en-US");
}

type Props = {
  amountName: string;
  currencyName: string;
  id?: string;
  defaultAmount?: number | null;
  defaultCurrency?: string | null;
  placeholder?: string;
  min?: number;
  max?: number;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function MoneyInput({
  amountName,
  currencyName,
  id,
  defaultAmount,
  defaultCurrency,
  placeholder = "0",
  min = 0,
  max = 1_000_000,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: Props) {
  const [raw, setRaw] = useState<string>(
    defaultAmount !== null && defaultAmount !== undefined
      ? String(defaultAmount)
      : "",
  );
  const [currency, setCurrency] = useState<string>(defaultCurrency ?? "GBP");
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

  const display = useMemo(() => formatAmount(raw), [raw]);
  const submitted = useMemo(() => {
    if (!raw) return "";
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) return "";
    const n = Number(digits);
    if (Number.isNaN(n)) return "";
    const clamped = Math.min(max, Math.max(min, n));
    return String(clamped);
  }, [raw, min, max]);

  const handleChange = (value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    setRaw(digits);
  };

  const symbol = currencySymbol(currency);

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={amountName} value={submitted} />
      <input type="hidden" name={currencyName} value={currency} />

      <div className="flex items-stretch bg-bg-2 border border-line rounded-md hover:border-line-2 focus-within:border-line-2 transition-colors overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 px-3 border-r border-line text-[13px] font-mono tracking-[0.05em] uppercase text-fg-2 hover:bg-bg-3 hover:text-fg active:bg-bg-3 transition-colors cursor-pointer shrink-0"
        >
          <span className="w-[18px] text-center">{symbol}</span>
          <span className="text-fg-3">{currency}</span>
          <svg
            aria-hidden
            viewBox="0 0 10 10"
            className={`w-[10px] h-[10px] text-fg-3 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M2 3.5 L5 6.5 L8 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className="flex-1 bg-transparent px-[14px] py-[11px] text-[15px] tabular outline-none placeholder:text-fg-3 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[220px] max-w-[280px] bg-bg-2 border border-line rounded-md shadow-lg py-1 max-h-[280px] overflow-y-auto"
        >
          {CURRENCIES.map((c) => {
            const selected = c.code === currency;
            return (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setCurrency(c.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-bg-3 active:bg-bg-3 transition-colors cursor-pointer ${
                  selected ? "bg-bg-3" : ""
                }`}
              >
                <span className="w-[20px] text-center font-mono text-[14px] text-fg">
                  {c.symbol}
                </span>
                <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-2 w-[36px]">
                  {c.code}
                </span>
                <span className="text-[13px] text-fg-3 flex-1 truncate">
                  {c.label}
                </span>
                {selected && (
                  <span className="w-[5px] h-[5px] rounded-full bg-accent shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
