"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AirportSearch } from "./AirportSearch";
import type {
  AiBudgetTier,
  AiOriginAirport,
  AiPreferences,
  AiVibeTag,
} from "@/lib/types";
import type { AirportOption } from "@/lib/actions/airports";

/**
 * Modal gating the AI draft call. Captures the context the AI needs
 * that isn't on the trip row: crew origin airport, confirmed crew
 * size, budget tier, and vibe tags. Results are persisted to
 * trip.meta.ai_preferences by the server action so re-drafts skip
 * this modal unless the admin explicitly reopens it.
 */

type Props = {
  destination: string;
  defaultPreferences?: AiPreferences | null;
  defaultCrewSize: number;
  defaultCurrency: string;
  defaultBudgetPp: number | null;
  onCancel: () => void;
  onSubmit: (prefs: AiPreferences) => void;
};

const VIBE_OPTIONS: { tag: AiVibeTag; label: string }[] = [
  { tag: "chill", label: "Chill" },
  { tag: "active", label: "Active" },
  { tag: "foodie", label: "Foodie" },
  { tag: "nightlife", label: "Nightlife" },
  { tag: "culture", label: "Culture" },
  { tag: "outdoors", label: "Outdoors" },
  { tag: "beach", label: "Beach" },
];

const BUDGET_PRESETS: {
  tier: AiBudgetTier;
  label: string;
  sub: string;
  pp: number | null;
}[] = [
  { tier: "tight", label: "Tight", sub: "Hostels, street food", pp: 400 },
  { tier: "mid", label: "Mid", sub: "Airbnb, good restaurants", pp: 950 },
  { tier: "lavish", label: "Lavish", sub: "Nice hotels, omakase", pp: 2500 },
  { tier: "custom", label: "Custom", sub: "Set the amount", pp: null },
];

export function AIDraftPreferences({
  destination,
  defaultPreferences,
  defaultCrewSize,
  defaultCurrency,
  defaultBudgetPp,
  onCancel,
  onSubmit,
}: Props) {
  const [originQuery, setOriginQuery] = useState(
    defaultPreferences?.origin?.name ?? "",
  );
  const [origin, setOrigin] = useState<AiOriginAirport | null>(
    defaultPreferences?.origin ?? null,
  );
  const [crewSize, setCrewSize] = useState<number>(
    defaultPreferences?.crew_size ?? Math.max(1, defaultCrewSize),
  );
  const [budgetTier, setBudgetTier] = useState<AiBudgetTier>(
    defaultPreferences?.budget_tier ?? (defaultBudgetPp ? "custom" : "mid"),
  );
  const [budgetCustom, setBudgetCustom] = useState<number | "">(
    defaultPreferences?.budget_custom_pp ?? defaultBudgetPp ?? "",
  );
  const [vibes, setVibes] = useState<AiVibeTag[]>(
    defaultPreferences?.vibes ?? ["chill", "foodie"],
  );

  const handleOriginSelect = (a: AirportOption) => {
    setOriginQuery(a.name);
    setOrigin({
      name: a.name,
      address: a.address || null,
      latitude: a.latitude,
      longitude: a.longitude,
      placeId: a.id || null,
    });
  };

  const toggleVibe = (tag: AiVibeTag) => {
    setVibes((prev) =>
      prev.includes(tag) ? prev.filter((v) => v !== tag) : [...prev, tag],
    );
  };

  const canSubmit = originQuery.trim().length > 0 && crewSize >= 1;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      origin: origin ?? {
        name: originQuery.trim(),
        address: null,
        latitude: null,
        longitude: null,
        placeId: null,
      },
      crew_size: crewSize,
      budget_tier: budgetTier,
      budget_custom_pp:
        budgetTier === "custom" && typeof budgetCustom === "number"
          ? budgetCustom
          : null,
      vibes,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-prefs-title"
      className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-start justify-center px-4 py-10 overflow-y-auto"
    >
      <div className="w-full max-w-[560px] bg-bg-2 border border-line rounded-md">
        <header className="flex items-center justify-between px-7 py-5 border-b border-line">
          <div className="flex items-center gap-2">
            <span
              className="w-[6px] h-[6px] rounded-full bg-accent brand-dot"
              aria-hidden="true"
            />
            <span className="label-sm text-accent">Before we draft</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="text-fg-3 hover:text-fg text-[16px] cursor-pointer"
          >
            ✕
          </button>
        </header>

        <div className="px-7 py-7 grid gap-8">
          <div>
            <h2
              id="ai-prefs-title"
              className="text-[24px] font-medium tracking-[-0.02em] mb-1"
            >
              Tell us about the trip to {destination}
              <span className="text-accent">.</span>
            </h2>
            <p className="text-fg-2 text-[14px] leading-[1.5]">
              A few details so the draft actually reflects the crew
              instead of a generic itinerary.
            </p>
          </div>

          <section className="grid gap-2">
            <label className="label-sm-wide text-fg-3">
              Origin airport
            </label>
            <AirportSearch
              value={originQuery}
              onChange={(v) => {
                setOriginQuery(v);
                if (origin && v !== origin.name) setOrigin(null);
              }}
              onSelect={handleOriginSelect}
              selected={
                origin
                  ? {
                      id: origin.placeId ?? "",
                      name: origin.name,
                      address: origin.address ?? "",
                      latitude: origin.latitude,
                      longitude: origin.longitude,
                    }
                  : null
              }
              autoFocus
            />
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3">
              Drives the flights spec cell and day-1 schedule framing.
            </p>
          </section>

          <section className="grid gap-3">
            <label className="label-sm-wide text-fg-3">Crew size</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCrewSize(n)}
                  className={`h-10 w-12 rounded-md border text-[14px] font-medium tabular transition-colors cursor-pointer ${
                    crewSize === n
                      ? "bg-accent text-bg border-accent"
                      : "bg-bg-2 border-line text-fg-2 hover:border-line-2 hover:text-fg"
                  }`}
                >
                  {n === 10 ? "10+" : n}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <label className="label-sm-wide text-fg-3">
              Budget per head ({defaultCurrency})
            </label>
            <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
              {BUDGET_PRESETS.map((p) => {
                const active = budgetTier === p.tier;
                return (
                  <button
                    key={p.tier}
                    type="button"
                    onClick={() => setBudgetTier(p.tier)}
                    className={`text-left p-3 rounded-md border transition-colors cursor-pointer ${
                      active
                        ? "border-accent bg-accent/[0.06]"
                        : "border-line bg-bg-2 hover:border-line-2"
                    }`}
                  >
                    <div
                      className={`text-[13px] font-medium mb-0.5 ${active ? "text-accent" : "text-fg"}`}
                    >
                      {p.label}
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
            {budgetTier === "custom" && (
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                value={budgetCustom}
                onChange={(e) => {
                  const n = e.target.value;
                  setBudgetCustom(n === "" ? "" : Number(n));
                }}
                placeholder="e.g. 1500"
                className="bg-bg-2 border border-line px-[14px] py-[11px] text-[15px] rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3 tabular"
              />
            )}
          </section>

          <section className="grid gap-3">
            <label className="label-sm-wide text-fg-3">
              Vibe · pick what fits
            </label>
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map((v) => {
                const active = vibes.includes(v.tag);
                return (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => toggleVibe(v.tag)}
                    aria-pressed={active}
                    className={`h-9 px-4 rounded-full border text-[13px] font-medium transition-colors cursor-pointer ${
                      active
                        ? "bg-accent text-bg border-accent"
                        : "bg-bg-2 border-line text-fg-2 hover:border-line-2 hover:text-fg"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 px-7 py-5 border-t border-line">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            tone="accent"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Draft this trip →
          </Button>
        </footer>
      </div>
    </div>
  );
}
