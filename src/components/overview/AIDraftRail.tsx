"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { redraftSection } from "@/lib/actions/aiDraft";
import { AIDraftProgress } from "./AIDraftProgress";
import { AIDraftHistory } from "./AIDraftHistory";
import type { DraftSurface } from "@/lib/ai";

type Props = {
  tripId: string;
  destination: string;
  surface: DraftSurface;
  draftedAt: string | null;
  isAdmin: boolean;
  canRedraft: boolean;
  blockedReason: string | null;
  versionsCount?: number;
};

export function AIDraftRail({
  tripId,
  destination,
  surface,
  draftedAt,
  isAdmin,
  canRedraft,
  blockedReason,
  versionsCount = 0,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const disabled = !canRedraft || pending || generating;

  const handleRedraft = () => {
    if (disabled) return;
    setGenerating(true);
    startTransition(async () => {
      const res = await redraftSection({ tripId, surface });
      setGenerating(false);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Redrafted.");
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-2 relative flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-[5px] label-xs text-fg-3"
          title={draftedAt ? `Drafted by AI · ${relTime(draftedAt)}` : "Drafted by AI"}
        >
          <span
            className="w-[4px] h-[4px] rounded-full bg-accent"
            aria-hidden="true"
          />
          AI {draftedAt && <>· {relTime(draftedAt)}</>}
        </span>

        {isAdmin && (
          <div className="flex items-center gap-5">
            {versionsCount > 0 && (
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={historyOpen}
                aria-label={`Show previous ${humanSurface(surface)} drafts`}
                className="label-xs text-fg-3 hover:text-fg transition-colors cursor-pointer tabular"
              >
                <span aria-hidden="true">↺</span> {versionsCount} prev
              </button>
            )}
            <button
              type="button"
              onClick={handleRedraft}
              disabled={disabled}
              title={canRedraft ? "Re-draft this section" : blockedReason ?? undefined}
              aria-label={`Redraft ${humanSurface(surface)}`}
              className={`label-xs transition-colors cursor-pointer disabled:cursor-not-allowed ${
                !canRedraft
                  ? "text-fg-4"
                  : "text-fg-3 hover:text-accent"
              }`}
            >
              <span aria-hidden="true">↻</span> redraft
            </button>
          </div>
        )}

        {historyOpen && (
          <AIDraftHistory
            tripId={tripId}
            surface={surface}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>

      {generating && <AIDraftProgress destination={destination} />}
    </>
  );
}

function humanSurface(s: DraftSurface): string {
  if (s === "spec_grid") return "spec";
  return s;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
