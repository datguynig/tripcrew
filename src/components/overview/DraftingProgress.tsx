"use client";

import { useEffect, useState } from "react";

const STAGES = [
  { label: "Mapping the destination", duration: 2500 },
  { label: "Pulling live places (food, hotels, sights)", duration: 4000 },
  { label: "Drafting the day-by-day itinerary", duration: 6000 },
  { label: "Estimating budget bands", duration: 2500 },
  { label: "Polishing", duration: 2000 },
];

export function DraftingProgress({ destination }: { destination: string }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now() - start;
      setElapsed(now);
      let acc = 0;
      let idx = STAGES.length - 1;
      for (let i = 0; i < STAGES.length; i++) {
        acc += STAGES[i].duration;
        if (now < acc) {
          idx = i;
          break;
        }
      }
      setStageIdx(idx);
    }, 200);
    return () => window.clearInterval(interval);
  }, []);

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

      <ol className="grid gap-3 max-w-[520px]">
        {STAGES.map((stage, i) => {
          const done = i < stageIdx;
          const active = i === stageIdx;
          return (
            <li
              key={stage.label}
              className={[
                "flex items-center gap-3 text-[14px] leading-[1.5]",
                done
                  ? "text-fg-3"
                  : active
                    ? "text-fg"
                    : "text-fg-3/60",
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
            </li>
          );
        })}
      </ol>

      <p className="mt-7 text-[12px] text-fg-3 leading-[1.5] max-w-[520px]">
        This usually lands in 10-20 seconds. The page will update on its own.
        {elapsed > 25000 && (
          <>
            {" "}
            Still drafting. Tight schemas can need a second pass; give it
            another 10 seconds before retrying.
          </>
        )}
      </p>
    </div>
  );
}
