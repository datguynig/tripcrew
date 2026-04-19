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
 * Editorial command bar for proposing a destination.
 *
 * One field does three jobs: input, autocomplete gazetteer, submit. When a
 * Mapbox suggestion is chosen the field "arms" — the border picks up accent,
 * a coordinate ticker prints below, and the submit chip goes live. Falls
 * back to a plain input when NEXT_PUBLIC_MAPBOX_TOKEN is missing so the
 * propose flow still works without a token.
 */

type Selected = {
  longitude: number;
  latitude: number;
  country: string | null;
} | null;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: PlaceDetails) => void;
  // When provided, the field renders an integrated submit chip and turns
  // the whole component into a command bar. Omit for a plain search field
  // (e.g. inside a form that owns its own submit).
  onSubmit?: () => void;
  selected?: Selected;
  pending?: boolean;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
};

export function DestinationSearch({
  value,
  onChange,
  onSelect,
  onSubmit,
  selected = null,
  pending = false,
  placeholder = "Propose a destination (e.g. Lisbon)",
  maxLength = 120,
  autoFocus = false,
}: Props) {
  const enabled = useMemo(() => mapboxEnabled(), []);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [focused, setFocused] = useState(false);
  const sessionRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Once a suggestion is picked, skip the autocomplete fetch for that
  // exact value so the dropdown doesn't snap closed → reopen with the
  // same results. Cleared when the user types a different value. Seed
  // with the initial value so a prefilled field (e.g. admin page with
  // an existing destination) doesn't auto-open a suggestion list on
  // mount — the user didn't type it.
  const justPickedRef = useRef<string | null>(value || null);

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
      setOpen(false);
      return;
    }
    // The value was just set by handleSelect; don't re-fetch against it.
    if (justPickedRef.current !== null && justPickedRef.current === value) {
      return;
    }
    justPickedRef.current = null;

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
    justPickedRef.current = s.name;
    onChange(s.name);
    setOpen(false);
    setSuggestions([]);
    if (!onSelect) return;
    const place = await retrievePlace(s.mapboxId, sessionRef.current);
    if (place) onSelect(place);
    sessionRef.current = newSessionToken();
  };

  const canSubmit = value.trim().length > 0 && !pending;
  const matched = !!selected;
  const hasSubmit = !!onSubmit;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && !e.shiftKey && onSubmit) {
        e.preventDefault();
        if (canSubmit) onSubmit();
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

  const input = (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={enabled ? handleKeyDown : undefined}
      onFocus={() => {
        setFocused(true);
        if (enabled && suggestions.length > 0) setOpen(true);
      }}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      aria-label="Destination"
      {...(enabled
        ? {
            "aria-autocomplete": "list" as const,
            "aria-expanded": open,
            "aria-controls": "destination-suggestions",
            role: "combobox",
          }
        : {
            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" && !e.shiftKey && onSubmit) {
                e.preventDefault();
                if (canSubmit) onSubmit();
              }
            },
          })}
      className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] tracking-[-0.01em] placeholder:text-fg-3 py-[13px]"
    />
  );

  const shell = (
    <FieldShell focused={focused} matched={matched} hasSubmit={hasSubmit}>
      <PrefixMark matched={matched} />
      {input}
      <div
        className={`flex items-center gap-2 shrink-0 ${hasSubmit ? "pr-[5px]" : "pr-[14px]"}`}
      >
        {loading && !matched && enabled && (
          <span
            className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse"
            aria-label="Searching"
          />
        )}
        {hasSubmit && onSubmit && (
          <SubmitChip
            enabled={canSubmit}
            matched={matched}
            pending={pending}
            onClick={onSubmit}
          />
        )}
      </div>
    </FieldShell>
  );

  if (!enabled) {
    return (
      <div>
        {shell}
        {matched && selected && (
          <CoordTicker
            latitude={selected.latitude}
            longitude={selected.longitude}
            country={selected.country}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {shell}

      {open && suggestions.length > 0 && (
        <div
          id="destination-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 bg-bg-2 border border-line rounded-md shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 h-8 border-b border-line">
            <div className="label-sm text-fg-3 tabular">
              Suggestions · {suggestions.length.toString().padStart(2, "0")}
            </div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-fg-3 flex items-center gap-3">
              <span>↑↓ nav</span>
              <span className="text-accent">↵ pick</span>
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {suggestions.map((s, i) => {
              const { middle, tail } = splitPlace(s.placeFormatted, s.name);
              const active = i === highlight;
              return (
                <button
                  key={s.mapboxId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => void handleSelect(s)}
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
                      {s.name}
                    </div>
                    {middle && (
                      <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3 mt-0.5 truncate">
                        {middle}
                      </div>
                    )}
                  </div>
                  {tail && (
                    <div
                      className={`font-mono text-[10px] tracking-[0.15em] uppercase shrink-0 ${
                        active ? "text-fg" : "text-fg-2"
                      }`}
                    >
                      {tail}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {matched && selected && (
        <CoordTicker
          latitude={selected.latitude}
          longitude={selected.longitude}
          country={selected.country}
        />
      )}
    </div>
  );
}

function FieldShell({
  focused,
  matched,
  hasSubmit,
  children,
}: {
  focused: boolean;
  matched: boolean;
  hasSubmit: boolean;
  children: React.ReactNode;
}) {
  const border = matched
    ? "border-accent/60"
    : focused
      ? "border-line-2"
      : "border-line";
  return (
    <div
      className={`flex items-center gap-3 bg-bg-2 border ${border} rounded-md pl-4 transition-colors ${hasSubmit ? "min-h-[46px]" : ""}`}
    >
      {children}
    </div>
  );
}

function PrefixMark({ matched }: { matched: boolean }) {
  return (
    <div
      className="flex items-center gap-2 shrink-0 select-none"
      aria-hidden="true"
    >
      <span
        className={`font-mono text-[10px] tracking-[0.2em] uppercase transition-colors ${
          matched ? "text-accent" : "text-fg-3"
        }`}
      >
        Where
      </span>
      <span
        className={`font-mono text-[13px] leading-none transition-colors ${
          matched ? "text-accent" : "text-fg-4"
        }`}
      >
        ›
      </span>
    </div>
  );
}

function SubmitChip({
  enabled,
  matched,
  pending,
  onClick,
}: {
  enabled: boolean;
  matched: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const base =
    "h-[34px] px-[14px] rounded-[5px] flex items-center gap-[8px] font-mono text-[10px] tracking-[0.18em] uppercase transition-colors disabled:cursor-not-allowed cursor-pointer";
  const style = !enabled
    ? "bg-transparent text-fg-4"
    : matched
      ? "bg-accent text-bg hover:opacity-90"
      : "bg-bg-3 text-fg-2 hover:bg-fg hover:text-bg";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className={`${base} ${style}`}
      aria-label={matched ? "Propose pinned destination" : "Propose destination"}
    >
      <span>{pending ? "Proposing" : "Propose"}</span>
      {!pending && <span className="text-[12px] leading-none">↵</span>}
    </button>
  );
}

function CoordTicker({
  latitude,
  longitude,
  country,
}: {
  latitude: number;
  longitude: number;
  country: string | null;
}) {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  return (
    <div className="mt-[10px] flex items-center gap-[10px] font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3 tabular">
      <span
        className="w-[5px] h-[5px] rounded-full bg-accent"
        aria-hidden="true"
      />
      <span className="text-fg-2">
        {lat} · {lon}
      </span>
      {country && (
        <>
          <span className="text-fg-4" aria-hidden="true">
            ·
          </span>
          <span className="text-fg-2">{country}</span>
        </>
      )}
      <span className="text-fg-4" aria-hidden="true">
        ·
      </span>
      <span className="text-accent">pinned</span>
    </div>
  );
}

// Mapbox returns "City, Region, Country". We already show `name` as the
// heading, so split the remainder: middle segments become a mono meta line
// (region), and the final segment becomes a right-aligned country tag.
function splitPlace(
  placeFormatted: string,
  name: string,
): { middle: string; tail: string } {
  if (!placeFormatted) return { middle: "", tail: "" };
  const parts = placeFormatted
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { middle: "", tail: "" };
  const tail = parts[parts.length - 1];
  const middleParts = parts.slice(0, -1).filter((p) => p !== name);
  return {
    middle: middleParts.join(" · "),
    tail: tail === name ? "" : tail,
  };
}
