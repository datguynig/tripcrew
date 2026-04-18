"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen overlay shown while the draftTripAction is in flight.
 * The action is one blocking promise (~6-15s with Gemini + Places
 * loops). The cycling narrative gives the user a signal that real
 * work is happening so 12 seconds of silence doesn't feel broken.
 *
 * Closes when the parent un-mounts it (success or error). We don't
 * track real progress — the stages are theatrical, not truthful.
 */

const STAGES = [
  "Researching",
  "Finding venues",
  "Drafting schedule",
  "Sketching the trip",
  "Almost there",
];

type Props = {
  destination: string;
};

export function AIDraftProgress({ destination }: Props) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center px-6"
    >
      <div className="max-w-[460px] w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span
            className="w-[8px] h-[8px] rounded-full bg-accent animate-pulse"
            aria-hidden="true"
          />
          <span className="label-sm text-accent">AI · Working</span>
        </div>

        <div
          className="text-[32px] font-medium tracking-[-0.03em] leading-[1.05] mb-3 min-h-[80px]"
          key={stage}
        >
          {STAGES[stage]}
          <span className="text-accent"> {destination}</span>
          <span className="text-fg-3">.</span>
        </div>

        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3">
          This usually takes ~10 seconds.
        </p>

        <div className="mt-8 flex items-center justify-center gap-[6px]">
          {STAGES.map((_, i) => (
            <span
              key={i}
              className={`w-[6px] h-[6px] rounded-full transition-colors ${
                i <= stage ? "bg-accent" : "bg-bg-3"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
