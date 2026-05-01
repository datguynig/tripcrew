"use client";

import { useEffect, useState } from "react";
import type { DraftStage, DraftProgress } from "@/lib/types";

const STAGES: { id: DraftStage; label: string }[] = [
  { id: "places", label: "Pulling live places" },
  { id: "weather", label: "Checking the weather" },
  { id: "drafting", label: "Drafting itinerary, hotels, and budget" },
  { id: "saving", label: "Saving the plan" },
];

function indexOfStage(id: DraftStage | undefined): number {
  if (!id) return 0;
  const i = STAGES.findIndex((s) => s.id === id);
  return i === -1 ? 0 : i;
}

export function DraftingProgress({
  destination,
  progress,
}: {
  destination: string;
  progress: DraftProgress | null;
}) {
  const [elapsed, setElapsed] = useState(0);
  const stageIdx = indexOfStage(progress?.stage);
  const startedAt = progress?.startedAt
    ? Date.parse(progress.startedAt)
    : Date.now();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="border border-accent/40 bg-accent/[0.04] mb-10 px-7 py-10 max-[640px]:px-5 max-[640px]:py-8">
      <div className="flex items-center gap-2 mb-6">
        <span
          className="w-[6px] h-[6px] rounded-full bg-accent brand-dot animate-pulse"
          aria-hidden="true"
        />
        <span className="label-sm text-accent">Drafting your plan</span>
      </div>

      <h3 className="text-[28px] max-[640px]:text-[22px] font-medium tracking-[-0.025em] leading-[1.1] mb-7 max-w-[640px]">
        Building a plan for {destination}
        <span className="text-accent">.</span>
      </h3>

      <ol className="grid gap-3 max-w-[560px]">
        {STAGES.map((stage, i) => {
          const done = i < stageIdx;
          const active = i === stageIdx;
          return (
            <li
              key={stage.id}
              className={[
                "flex items-center gap-3 text-[14px] leading-[1.5]",
                done ? "text-fg-3" : active ? "text-fg" : "text-fg-3/60",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px]",
                  done
                    ? "bg-accent text-bg"
                    : active
                      ? "border border-accent text-accent animate-pulse"
                      : "border border-line text-fg-3",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={done ? "line-through" : ""}>
                {stage.label}
                {active && "…"}
              </span>
              {active && progress?.detail && (
                <span className="text-fg-3/80 text-[12px]">
                  · {progress.detail}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-7 text-[12px] text-fg-3 leading-[1.5] max-w-[520px]">
        This usually lands in 10-25 seconds. The page will update on its
        own.
        {elapsed > 35000 && (
          <>
            {" "}
            Still working. Drafts can take longer when the model retries
            for higher-quality output.
          </>
        )}
      </p>
    </div>
  );
}
