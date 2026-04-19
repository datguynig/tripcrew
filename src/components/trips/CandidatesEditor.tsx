"use client";

import { useState } from "react";
import { DestinationSearch } from "@/components/destinations/DestinationSearch";
import type { PlaceDetails } from "@/lib/mapbox";

/**
 * Repeater for destination candidates on the New Trip form.
 *
 * Each row is a Mapbox-backed DestinationSearch. When the user picks
 * a suggestion on the last row, a new empty row is auto-appended and
 * focused — so the user can keep listing candidates without breaking
 * flow. Hitting "+ Add another" manually still works as a fallback.
 *
 * Serializes to JSON in a hidden input named `candidates` so the
 * existing createTrip form action can read it from FormData.
 *
 * Cap: 20 candidates (matches the server action's slice limit).
 */

type Candidate = {
  title: string;
  mapboxId: string | null;
  longitude: number | null;
  latitude: number | null;
  country: string | null;
};

const MAX_CANDIDATES = 20;

function emptyCandidate(): Candidate {
  return {
    title: "",
    mapboxId: null,
    longitude: null,
    latitude: null,
    country: null,
  };
}

export function CandidatesEditor() {
  const [rows, setRows] = useState<Candidate[]>([emptyCandidate()]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const update = (i: number, patch: Partial<Candidate>) => {
    setRows((prev) => prev.map((r, ix) => (ix === i ? { ...r, ...patch } : r)));
  };

  const remove = (i: number) => {
    setRows((prev) => {
      if (prev.length === 1) return [emptyCandidate()];
      return prev.filter((_, ix) => ix !== i);
    });
  };

  const add = () => {
    setRows((prev) => {
      if (prev.length >= MAX_CANDIDATES) return prev;
      const next = [...prev, emptyCandidate()];
      setFocusIndex(next.length - 1);
      return next;
    });
  };

  const handlePick = (i: number, place: PlaceDetails) => {
    setRows((prev) => {
      const next = prev.map((r, ix) =>
        ix === i
          ? {
              title: place.name,
              mapboxId: place.mapboxId,
              longitude: place.longitude,
              latitude: place.latitude,
              country: place.country,
            }
          : r,
      );
      // If the picked row is the last row and we're under the cap,
      // open a fresh slot below so the user can keep listing.
      if (i === prev.length - 1 && next.length < MAX_CANDIDATES) {
        setFocusIndex(next.length);
        return [...next, emptyCandidate()];
      }
      return next;
    });
  };

  const serialized = JSON.stringify(
    rows
      .map((r) => ({ ...r, title: r.title.trim() }))
      .filter((r) => r.title.length > 0),
  );

  const canAdd = rows.length < MAX_CANDIDATES;
  const showRemoveRow = rows.length > 1 || rows[0].title.length > 0;

  return (
    <div className="grid gap-2">
      <input type="hidden" name="candidates" value={serialized} />
      {rows.map((row, i) => {
        const selected =
          row.longitude !== null && row.latitude !== null
            ? {
                longitude: row.longitude,
                latitude: row.latitude,
                country: row.country,
              }
            : null;
        return (
          <div
            key={i}
            className="flex items-start gap-2 max-[420px]:flex-col max-[420px]:items-stretch"
          >
            <div className="flex-1 min-w-0">
              <DestinationSearch
                value={row.title}
                onChange={(v) => {
                  update(i, { title: v });
                  if (row.mapboxId && v !== row.title) {
                    update(i, {
                      mapboxId: null,
                      longitude: null,
                      latitude: null,
                      country: null,
                    });
                  }
                }}
                onSelect={(place: PlaceDetails) => handlePick(i, place)}
                selected={selected}
                placeholder={i === 0 ? "e.g. Lisbon" : "Add another…"}
                maxLength={120}
                autoFocus={focusIndex === i}
              />
            </div>
            {showRemoveRow && (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove candidate ${i + 1}`}
                className="h-[46px] w-[46px] flex items-center justify-center text-fg-3 hover:text-err border border-line hover:border-err rounded-md transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {canAdd && (
        <button
          type="button"
          onClick={add}
          className="self-start mt-1 label-sm-wide text-accent hover:text-fg transition-colors cursor-pointer"
        >
          + Add another
        </button>
      )}
    </div>
  );
}
