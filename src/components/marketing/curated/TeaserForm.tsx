"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitTeaserForm } from "@/lib/actions/teaser";
import { searchPublicAirportsAction } from "@/lib/actions/publicAirports";
import type { AirportOption } from "@/lib/actions/airports";
import type { CuratedTrip } from "@/lib/marketing/curatedTrips";
import { RateLimitedNotice } from "./RateLimitedNotice";

const CREW_OPTIONS = [
  { label: "2", value: "2" as const },
  { label: "3–4", value: "3-4" as const },
  { label: "5–6", value: "5-6" as const },
  { label: "7+", value: "7+" as const },
];

const WHEN_OPTIONS = [
  { label: "a weekend", value: "weekend" as const },
  { label: "a week", value: "week" as const },
  { label: "two weeks", value: "two-weeks" as const },
  { label: "flexible", value: "flexible" as const },
];

const BUDGET_OPTIONS = [
  { label: "~£500", value: "500" as const },
  { label: "~£1k", value: "1000" as const },
  { label: "~£1.5k", value: "1500" as const },
  { label: "~£2k+", value: "2000+" as const },
];

type Crew = (typeof CREW_OPTIONS)[number]["value"];
type When = (typeof WHEN_OPTIONS)[number]["value"];
type Budget = (typeof BUDGET_OPTIONS)[number]["value"];

const SEGMENT_BASE =
  "inline-flex items-center justify-center min-h-[52px] px-3 border-2 border-ink font-mono uppercase tracking-[0.14em] text-[12px] cursor-pointer transition-[background-color,color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

const SEGMENT_IDLE = "bg-transparent text-ink hover:bg-ink/5";
const SEGMENT_ACTIVE = "bg-ink text-cream border-ink";

const LEGEND_CLASS =
  "block mb-3 font-mono uppercase tracking-[0.18em] text-[11px] text-ink";

/**
 * Try to extract a 3-letter IATA code from an airport result. Places
 * usually surfaces it inside the place name ("Heathrow Airport (LHR)")
 * or address ("LHR · London"). Metro options carry the code on a
 * dedicated field. Returns null when nothing plausible is found —
 * caller falls back to a manual prompt.
 */
function extractIata(option: AirportOption): string | null {
  if (option.metro) return option.metro.toUpperCase();
  const haystacks = [option.name, option.address];
  // Prefer parenthesised codes ("(LHR)") over bare matches —
  // they're far less ambiguous than 3 random uppercase letters
  // sitting inside a city name.
  for (const h of haystacks) {
    if (!h) continue;
    const paren = h.match(/\(([A-Z]{3})\)/);
    if (paren) return paren[1];
  }
  for (const h of haystacks) {
    if (!h) continue;
    const bare = h.match(/\b([A-Z]{3})\b/);
    if (bare) return bare[1];
  }
  return null;
}

function classes(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function TeaserForm({ trip }: { trip: CuratedTrip }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rateLimited, setRateLimited] = useState(false);

  const [origin, setOrigin] = useState<AirportOption | null>(null);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [whenChoice, setWhenChoice] = useState<When | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fromLabelId = useId();
  const crewLabelId = useId();
  const whenLabelId = useId();
  const budgetLabelId = useId();
  const emailId = useId();

  const submitDisabled =
    !origin ||
    !crew ||
    !whenChoice ||
    !budget ||
    email.trim().length === 0 ||
    isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!origin || !crew || !whenChoice || !budget) {
      setError("Pick an option for every field.");
      return;
    }

    const iata = extractIata(origin);
    if (!iata) {
      setError(
        "We couldn't read an airport code from that pick. Try the IATA (e.g. LHR).",
      );
      return;
    }

    const payload = {
      slug: trip.slug,
      origin: iata,
      crew,
      when: whenChoice,
      budget,
      email: email.trim(),
    };

    startTransition(async () => {
      const result = await submitTeaserForm(payload);
      if (result.ok) {
        // The cookie set on the server in the same response will be
        // picked up by the page server component on refresh, swapping
        // the gate view for the personalised view.
        router.refresh();
        return;
      }
      if (result.rateLimited) {
        setRateLimited(true);
        return;
      }
      setError(result.error);
    });
  }

  if (rateLimited) {
    return <RateLimitedNotice />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isPending}
      className="flex flex-col gap-9"
      noValidate
    >
      {/* Origin */}
      <fieldset>
        <legend id={fromLabelId} className={LEGEND_CLASS}>
          01 / From
        </legend>
        <PublicAirportTypeahead
          ariaLabelledBy={fromLabelId}
          selected={origin}
          onSelect={setOrigin}
          onClear={() => setOrigin(null)}
        />
      </fieldset>

      {/* Crew of */}
      <fieldset>
        <legend id={crewLabelId} className={LEGEND_CLASS}>
          02 / Crew of
        </legend>
        <div role="radiogroup" aria-labelledby={crewLabelId} className="grid grid-cols-4 gap-2 sm:gap-3">
          {CREW_OPTIONS.map((opt) => {
            const active = crew === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCrew(opt.value)}
                className={classes(SEGMENT_BASE, active ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* How long */}
      <fieldset>
        <legend id={whenLabelId} className={LEGEND_CLASS}>
          03 / How long
        </legend>
        <div role="radiogroup" aria-labelledby={whenLabelId} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {WHEN_OPTIONS.map((opt) => {
            const active = whenChoice === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setWhenChoice(opt.value)}
                className={classes(SEGMENT_BASE, active ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Budget per head */}
      <fieldset>
        <legend id={budgetLabelId} className={LEGEND_CLASS}>
          04 / Budget per head
        </legend>
        <div role="radiogroup" aria-labelledby={budgetLabelId} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {BUDGET_OPTIONS.map((opt) => {
            const active = budget === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBudget(opt.value)}
                className={classes(SEGMENT_BASE, active ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Email */}
      <fieldset>
        <label htmlFor={emailId} className={LEGEND_CLASS}>
          05 / Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          className="w-full bg-transparent border-2 border-ink px-5 py-4 text-[16px] text-ink placeholder:text-ink/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        />
      </fieldset>

      {/* Error */}
      {error && (
        <p
          role="alert"
          className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep"
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <div className="flex flex-col items-start gap-4 pt-2">
        <button
          type="submit"
          disabled={submitDisabled}
          className={classes(
            "inline-flex items-center justify-center min-h-[58px] px-8 border-2 font-mono uppercase tracking-[0.18em] text-[12px] transition-[background-color,color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
            submitDisabled
              ? "bg-transparent text-ink/40 border-ink/40 cursor-not-allowed"
              : "bg-marketing-coral text-ink border-marketing-coral cursor-pointer hover:bg-ink hover:text-cream hover:border-ink",
          )}
        >
          {isPending ? `Drafting your ${trip.city}…` : `See my ${trip.city} →`}
        </button>
        <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/70 max-w-[44ch]">
          We&rsquo;ll email you a link to resume this draft.
        </p>
      </div>
    </form>
  );
}

/**
 * Cream-themed airport typeahead used by the public marketing form.
 * Mirrors the structure of `AirportSearch.tsx` but skips the auth-gated
 * action and uses cream/ink tokens instead of the dark app shell.
 */
function PublicAirportTypeahead({
  selected,
  onSelect,
  onClear,
  ariaLabelledBy,
}: {
  selected: AirportOption | null;
  onSelect: (a: AirportOption) => void;
  onClear: () => void;
  ariaLabelledBy: string;
}) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [results, setResults] = useState<AirportOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [searchFailed, setSearchFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const justPickedRef = useRef<string | null>(selected?.name ?? null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (justPickedRef.current !== null && justPickedRef.current === query) {
      return;
    }
    justPickedRef.current = null;

    const controller = new AbortController();
    setLoading(true);
    setSearchFailed(false);
    const t = setTimeout(async () => {
      try {
        const res = await searchPublicAirportsAction({ query: trimmed });
        if (controller.signal.aborted) return;
        const hits = res.results ?? [];
        setResults(hits);
        setOpen(hits.length > 0);
        setHighlight(0);
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setOpen(false);
        setSearchFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query]);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (selected && v !== selected.name) onClear();
  };

  // Manual-IATA fallback. If the typeahead is unreachable (Places call
  // failed) the user can still progress by typing a 3-letter airport
  // code; on blur/Enter we synthesise a minimal option so the submit
  // button enables.
  const tryAcceptManualIata = () => {
    if (selected) return;
    if (!searchFailed) return;
    const code = query.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return;
    const synthetic: AirportOption = {
      id: `iata:${code}`,
      name: code,
      address: code,
      latitude: null,
      longitude: null,
    };
    onSelect(synthetic);
  };

  const handleSelect = (a: AirportOption) => {
    justPickedRef.current = a.name;
    setQuery(a.name);
    onSelect(a);
    setOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[highlight];
      if (pick) {
        handleSelect(pick);
      } else {
        tryAcceptManualIata();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        name="origin"
        autoComplete="off"
        role="combobox"
        aria-labelledby={ariaLabelledBy}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${ariaLabelledBy}-listbox`}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={tryAcceptManualIata}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder="Heathrow, LHR, London"
        maxLength={120}
        className="w-full bg-transparent border-2 border-ink px-5 py-4 text-[16px] text-ink placeholder:text-ink/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      />

      {loading && (
        <span
          aria-label="Searching"
          className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 w-[8px] h-[8px] bg-marketing-coral-deep brand-dot"
        />
      )}

      {searchFailed && !loading && (
        <p
          role="status"
          className="mt-2 font-mono uppercase tracking-[0.18em] text-[10px] text-ink/70"
        >
          Search unavailable. Type your 3-letter airport code (e.g. LHR).
        </p>
      )}

      {open && results.length > 0 && (
        <div
          id={`${ariaLabelledBy}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%-2px)] z-50 border-2 border-ink bg-cream max-h-[300px] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-5 h-9 border-b-2 border-ink/15 sticky top-0 bg-cream">
            <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
              Airports · {String(results.length).padStart(2, "0")}
            </p>
            <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 hidden sm:block">
              <span aria-hidden="true">↑↓ nav · ↵ pick</span>
            </p>
          </div>
          {results.map((a, i) => {
            const active = i === highlight;
            const isMetro = !!a.metro;
            return (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => handleSelect(a)}
                className={classes(
                  "relative w-full text-left pl-6 pr-5 py-3.5 flex items-center gap-4 transition-colors",
                  active ? "bg-ink/[0.04]" : "bg-transparent",
                )}
              >
                <span
                  aria-hidden="true"
                  className={classes(
                    "absolute left-0 top-0 bottom-0 w-[3px] transition-colors",
                    active ? "bg-marketing-coral" : "bg-transparent",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-[17px] leading-[1.2] tracking-[-0.01em] text-ink truncate">
                    {a.name}
                  </p>
                  {a.address && (
                    <p className="font-mono uppercase tracking-[0.16em] text-[10px] text-ink/60 mt-1 truncate">
                      {a.address}
                    </p>
                  )}
                </div>
                {isMetro && (
                  <span className="shrink-0 font-mono uppercase tracking-[0.18em] text-[10px] text-marketing-coral-deep tabular">
                    {a.metro} · {a.metroAirports?.length ?? 0}
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
