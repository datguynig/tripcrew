"use client";

import { useEffect, useRef, useState } from "react";
import {
  searchAirportsAction,
  type AirportOption,
} from "@/lib/actions/airports";

/**
 * Typeahead for picking a crew origin airport. Mirrors the look of
 * DestinationSearch's dropdown — mono label header, keyboard nav,
 * left-bar accent on highlighted row. Results come from Google Places
 * via a thin server action (Places key is server-only).
 */

type Selected = AirportOption | null;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (airport: AirportOption) => void;
  selected?: Selected;
  placeholder?: string;
  autoFocus?: boolean;
};

export function AirportSearch({
  value,
  onChange,
  onSelect,
  selected = null,
  placeholder = "Search airport — e.g. Heathrow, LHR",
  autoFocus = false,
}: Props) {
  const [results, setResults] = useState<AirportOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const justPickedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (justPickedRef.current !== null && justPickedRef.current === value) {
      return;
    }
    justPickedRef.current = null;

    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchAirportsAction({ query });
        if (controller.signal.aborted) return;
        const hits = res.results ?? [];
        setResults(hits);
        setOpen(hits.length > 0);
        setHighlight(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [value]);

  const handleSelect = (a: AirportOption) => {
    justPickedRef.current = a.name;
    onChange(a.name);
    onSelect(a);
    setOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const matched = !!selected;
  const border = matched
    ? "border-accent/60"
    : focused
      ? "border-line-2"
      : "border-line";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-3 bg-bg-2 border ${border} rounded-md pl-4 pr-4 min-h-[46px] transition-colors`}
      >
        <div
          className="flex items-center gap-2 shrink-0 select-none"
          aria-hidden="true"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.2em] uppercase transition-colors ${
              matched ? "text-accent" : "text-fg-3"
            }`}
          >
            From
          </span>
          <span
            className={`font-mono text-[13px] leading-none transition-colors ${
              matched ? "text-accent" : "text-fg-4"
            }`}
          >
            ›
          </span>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true);
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={120}
          autoFocus={autoFocus}
          aria-label="Origin airport"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] tracking-[-0.01em] placeholder:text-fg-3 py-[13px]"
        />
        {loading && !matched && (
          <span
            className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse shrink-0"
            aria-label="Searching"
          />
        )}
      </div>

      {open && results.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-bg-2 border border-line rounded-md shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 h-8 border-b border-line">
            <div className="label-sm text-fg-3 tabular">
              Airports · {results.length.toString().padStart(2, "0")}
            </div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-fg-3 flex items-center gap-3">
              <span>↑↓ nav</span>
              <span className="text-accent">↵ pick</span>
            </div>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {results.map((a, i) => {
              const active = i === highlight;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => handleSelect(a)}
                  className={`relative w-full text-left pl-5 pr-4 py-3 flex items-center gap-4 transition-colors ${
                    active ? "bg-bg-3" : ""
                  }`}
                >
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[2px] transition-colors ${
                      active ? "bg-accent" : "bg-transparent"
                    }`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium tracking-[-0.01em] truncate">
                      {a.name}
                    </div>
                    {a.address && (
                      <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3 mt-0.5 truncate">
                        {a.address}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
