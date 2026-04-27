"use client";

import { Button } from "@/components/ui/Button";
import { Select, type SelectOption } from "@/components/ui/Select";
import { INPUT } from "@/lib/styles";
import { AirportSearch } from "@/components/overview/AirportSearch";
import {
  BUDGET_TIER_LABELS,
  OCCASION_LABELS,
  VIBE_LABELS,
  type AiBudgetTier,
  type AiOccasion,
  type AiOriginAirport,
  type AiPreferences,
  type AiVibeTag,
  type TripPin,
} from "@/lib/types";
import type { AirportOption } from "@/lib/actions/airports";

/**
 * Controlled trip preferences form — collects rich context that the AI
 * uses to plan the trip. Used by the LockAndDraftDialog (at lock time)
 * and the admin TripPreferencesPanel (post-lock edits). Renders all the
 * sections (origin, crew, budget, vibes, occasion, notes, pinned moments)
 * in one scrollable form. Caller owns the state; this component only
 * renders + emits onChange.
 */

type Props = {
  value: AiPreferences;
  onChange: (next: AiPreferences) => void;
  defaultCurrency: string;
  hideOccasion?: boolean;
  // Trip dates power the pin date selector. Free-text "when" still works
  // when null, but a real date picker is nicer when we have them.
  tripDates?: { start: string | null; end: string | null };
};

const VIBE_GROUPS: { label: string; tags: AiVibeTag[] }[] = [
  { label: "Pace", tags: ["chill", "active", "adventure"] },
  { label: "Setting", tags: ["beach", "outdoors", "nature", "urban"] },
  { label: "Food & drink", tags: ["foodie", "nightlife", "party"] },
  { label: "Culture", tags: ["culture", "art", "historic"] },
  {
    label: "Vibe",
    tags: ["romantic", "family_friendly", "luxury", "wellness"],
  },
  { label: "Special", tags: ["photogenic", "sport", "music"] },
];

const OCCASION_ORDER: AiOccasion[] = [
  "group_holiday",
  "guys_trip",
  "girls_trip",
  "couples_trip",
  "birthday",
  "anniversary",
  "honeymoon",
  "babymoon",
  "engagement",
  "hen_do",
  "stag_do",
  "family",
  "graduation",
  "reunion",
  "corporate_retreat",
];

const OCCASION_OPTIONS: SelectOption<AiOccasion>[] = OCCASION_ORDER.map((o) => ({
  value: o,
  label: OCCASION_LABELS[o],
}));

const BUDGET_PRESETS: {
  tier: AiBudgetTier;
  sub: string;
  pp: number | null;
}[] = [
  { tier: "tight", sub: "Hostels, street food", pp: 400 },
  { tier: "mid", sub: "Airbnb, good restaurants", pp: 950 },
  { tier: "lavish", sub: "Nice hotels, omakase", pp: 2500 },
  { tier: "custom", sub: "Set the amount", pp: null },
];

const MAX_PINS = 5;

export function TripPreferencesForm({
  value,
  onChange,
  defaultCurrency,
  hideOccasion = false,
  tripDates,
}: Props) {
  const update = (patch: Partial<AiPreferences>) =>
    onChange({ ...value, ...patch });

  const handleOriginSelect = (a: AirportOption) => {
    const next: AiOriginAirport = {
      name: a.name,
      address: a.address || null,
      latitude: a.latitude,
      longitude: a.longitude,
      placeId: a.id || null,
      metro: a.metro ?? null,
      metroAirports: a.metroAirports ?? null,
    };
    update({ origin: next });
  };

  const toggleVibe = (tag: AiVibeTag) => {
    const next = value.vibes.includes(tag)
      ? value.vibes.filter((v) => v !== tag)
      : [...value.vibes, tag];
    update({ vibes: next });
  };

  const setPin = (idx: number, patch: Partial<TripPin>) => {
    const pins = [...(value.pins ?? [])];
    pins[idx] = { ...pins[idx], ...patch };
    update({ pins });
  };

  const addPin = () => {
    const pins = [...(value.pins ?? [])];
    if (pins.length >= MAX_PINS) return;
    pins.push({
      title: "",
      when: "",
      date: null,
      priority: "must",
      notes: "",
    });
    update({ pins });
  };

  const removePin = (idx: number) => {
    const pins = (value.pins ?? []).filter((_, i) => i !== idx);
    update({ pins });
  };

  const pins = value.pins ?? [];

  return (
    <div className="grid gap-8">
      {/* Origin */}
      <section className="grid gap-2">
        <label className="label-sm-wide text-fg-3">Origin airport</label>
        <AirportSearch
          value={value.origin?.name ?? ""}
          onChange={(v) => {
            if (value.origin && v !== value.origin.name) {
              update({ origin: null });
            }
          }}
          onSelect={handleOriginSelect}
          selected={
            value.origin
              ? {
                  id: value.origin.placeId ?? "",
                  name: value.origin.name,
                  address: value.origin.address ?? "",
                  latitude: value.origin.latitude,
                  longitude: value.origin.longitude,
                  metro: value.origin.metro ?? null,
                  metroAirports: value.origin.metroAirports ?? null,
                }
              : null
          }
        />
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3">
          Drives the flights spec cell, day-1 framing, and Google Flights link.
        </p>
      </section>

      {/* Crew size */}
      <section className="grid gap-3">
        <label className="label-sm-wide text-fg-3">Crew size</label>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update({ crew_size: n })}
              className={`h-10 w-12 rounded-md border text-[14px] font-medium tabular transition-colors cursor-pointer ${
                value.crew_size === n
                  ? "bg-accent text-bg border-accent"
                  : "bg-bg-2 border-line text-fg-2 hover:border-line-2 hover:text-fg"
              }`}
            >
              {n === 10 ? "10+" : n}
            </button>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="grid gap-3">
        <label className="label-sm-wide text-fg-3">
          Budget per head ({defaultCurrency})
        </label>
        <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
          {BUDGET_PRESETS.map((p) => {
            const active = value.budget_tier === p.tier;
            return (
              <button
                key={p.tier}
                type="button"
                onClick={() => update({ budget_tier: p.tier })}
                className={`text-left p-3 rounded-md border transition-colors cursor-pointer ${
                  active
                    ? "border-accent bg-accent/[0.06]"
                    : "border-line bg-bg-2 hover:border-line-2"
                }`}
              >
                <div
                  className={`text-[13px] font-medium mb-0.5 ${active ? "text-accent" : "text-fg"}`}
                >
                  {BUDGET_TIER_LABELS[p.tier]}
                  {p.pp && (
                    <span className="font-mono text-[11px] text-fg-3 ml-1.5 tabular">
                      ~{defaultCurrency} {p.pp.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3">
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>
        {value.budget_tier === "custom" && (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            value={value.budget_custom_pp ?? ""}
            onChange={(e) => {
              const n = e.target.value;
              update({ budget_custom_pp: n === "" ? null : Number(n) });
            }}
            placeholder="e.g. 1500"
            className={`${INPUT} tabular`}
          />
        )}
      </section>

      {/* Vibes */}
      <section className="grid gap-3">
        <label className="label-sm-wide text-fg-3">Vibe · pick what fits</label>
        <div className="grid gap-3">
          {VIBE_GROUPS.map((g) => (
            <div key={g.label} className="grid gap-2">
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3">
                {g.label}
              </span>
              <div className="flex flex-wrap gap-2">
                {g.tags.map((tag) => {
                  const active = value.vibes.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleVibe(tag)}
                      aria-pressed={active}
                      className={`h-9 px-4 rounded-full border text-[13px] font-medium transition-colors cursor-pointer ${
                        active
                          ? "bg-accent text-bg border-accent"
                          : "bg-bg-2 border-line text-fg-2 hover:border-line-2 hover:text-fg"
                      }`}
                    >
                      {VIBE_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Occasion */}
      {!hideOccasion && (
        <section className="grid gap-2">
          <label className="label-sm-wide text-fg-3">Occasion</label>
          <Select<AiOccasion>
            options={OCCASION_OPTIONS}
            value={value.occasion ?? ""}
            onChange={(next) =>
              update({ occasion: next === "" ? undefined : next })
            }
            placeholder="Pick one (optional)"
          />
        </section>
      )}

      {/* Notes */}
      <section className="grid gap-2">
        <label className="label-sm-wide text-fg-3">Notes</label>
        <textarea
          value={value.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value || undefined })}
          placeholder="Anything the AI should know — accessibility, dietaries, in-jokes, must-haves"
          rows={3}
          maxLength={400}
          className={`${INPUT} resize-none`}
        />
      </section>

      {/* Pinned moments */}
      <section className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <label className="label-sm-wide text-fg-3">
            Pinned moments · the AI builds the plan around these
          </label>
          <span className="font-mono text-[10px] tracking-[0.08em] text-fg-3 tabular">
            {pins.length}/{MAX_PINS}
          </span>
        </div>

        {pins.length === 0 && (
          <p className="text-[13px] text-fg-3 leading-[1.55]">
            Optional. Add specific things you want in the plan — match days,
            big-deal dinners, skydiving on someone&apos;s birthday. The AI
            schedules around them.
          </p>
        )}

        {pins.map((pin, idx) => (
          <PinCard
            key={idx}
            pin={pin}
            tripDates={tripDates}
            onChange={(patch) => setPin(idx, patch)}
            onRemove={() => removePin(idx)}
          />
        ))}

        {pins.length < MAX_PINS && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addPin}
          >
            + Add pinned moment
          </Button>
        )}
      </section>
    </div>
  );
}

function PinCard({
  pin,
  tripDates,
  onChange,
  onRemove,
}: {
  pin: TripPin;
  tripDates?: { start: string | null; end: string | null };
  onChange: (patch: Partial<TripPin>) => void;
  onRemove: () => void;
}) {
  const helperWhen = tripDates?.start
    ? `e.g. "Saturday evening" or pick a specific day`
    : `e.g. "Saturday evening" or "Day 3 morning"`;

  return (
    <div className="border border-line bg-bg-2 rounded-md p-4 grid gap-3">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={pin.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="What's the moment? (e.g. Watch FC Barcelona at Camp Nou)"
          maxLength={120}
          className={`${INPUT} flex-1`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove pinned moment"
          className="text-fg-3 hover:text-err transition-colors text-[18px] px-2 cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 max-[480px]:grid-cols-1">
        <div className="grid gap-1">
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3">
            When
          </span>
          <input
            type="text"
            value={pin.when ?? ""}
            onChange={(e) => onChange({ when: e.target.value || null })}
            placeholder={helperWhen}
            maxLength={80}
            className={INPUT}
          />
        </div>
        <div className="grid gap-1">
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3">
            Priority
          </span>
          <div className="flex gap-2 h-[42px]">
            <button
              type="button"
              onClick={() => onChange({ priority: "must" })}
              className={`flex-1 px-3 rounded-md border text-[13px] font-medium transition-colors cursor-pointer ${
                pin.priority === "must"
                  ? "bg-accent text-bg border-accent"
                  : "bg-bg-2 border-line text-fg-2 hover:border-line-2"
              }`}
            >
              Must-do
            </button>
            <button
              type="button"
              onClick={() => onChange({ priority: "nice" })}
              className={`flex-1 px-3 rounded-md border text-[13px] font-medium transition-colors cursor-pointer ${
                pin.priority === "nice"
                  ? "bg-accent text-bg border-accent"
                  : "bg-bg-2 border-line text-fg-2 hover:border-line-2"
              }`}
            >
              Nice-to-have
            </button>
          </div>
        </div>
      </div>

      <textarea
        value={pin.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value || null })}
        placeholder="Notes (optional) — booking link, prep, gear, weather-dependent"
        rows={2}
        maxLength={300}
        className={`${INPUT} resize-none text-[13px]`}
      />
    </div>
  );
}
