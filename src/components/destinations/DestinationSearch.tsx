"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  mapboxEnabled,
  newSessionToken,
  retrievePlace,
  suggestPlaces,
  type PlaceDetails,
  type PlaceSuggestion,
} from "@/lib/mapbox";

/**
 * Autocomplete for place names via Mapbox. Falls back to a plain text
 * input when NEXT_PUBLIC_MAPBOX_TOKEN is missing so the propose flow
 * still works without a token. Selection optionally returns lon/lat
 * via `onSelect` — parent decides whether to store them.
 */

const INPUT_CLASS =
  "bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 w-full";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: PlaceDetails) => void;
  placeholder?: string;
  maxLength?: number;
  onEnter?: () => void;
};

export function DestinationSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Propose a destination (e.g. Lisbon)",
  maxLength = 120,
  onEnter,
}: Props) {
  const enabled = useMemo(() => mapboxEnabled(), []);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const sessionRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (sessionRef.current === "" && enabled) {
    sessionRef.current = newSessionToken();
  }

  useEffect(() => {
    if (!enabled) return;
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await suggestPlaces(
          query,
          sessionRef.current,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setOpen(results.length > 0);
        setHighlight(0);
      } catch (err) {
        // Aborts on re-keystroke are expected — swallow them.
        if (
          err instanceof DOMException &&
          (err.name === "AbortError" || err.code === 20)
        ) {
          return;
        }
        throw err;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [value, enabled]);

  const handleSelect = async (s: PlaceSuggestion) => {
    onChange(s.name);
    setOpen(false);
    setSuggestions([]);
    if (!onSelect) return;
    const place = await retrievePlace(s.mapboxId, sessionRef.current);
    if (place) onSelect(place);
    sessionRef.current = newSessionToken();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && !e.shiftKey && onEnter) {
        e.preventDefault();
        onEnter();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void handleSelect(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!enabled) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        className={INPUT_CLASS}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="destination-suggestions"
        role="combobox"
        className={INPUT_CLASS}
      />

      {open && suggestions.length > 0 && (
        <div
          id="destination-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 bg-bg-2 border border-line rounded-md shadow-lg max-h-[280px] overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.mapboxId}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => void handleSelect(s)}
              className={`w-full text-left px-4 py-[10px] transition-colors ${
                i === highlight ? "bg-bg-3" : ""
              }`}
            >
              <div className="text-[14px] font-medium tracking-[-0.01em]">
                {s.name}
              </div>
              {s.placeFormatted && s.placeFormatted !== s.name && (
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-fg-3 mt-0.5 truncate">
                  {s.placeFormatted}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {loading && !open && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-[0.15em] uppercase text-fg-3">
          …
        </div>
      )}
    </div>
  );
}
