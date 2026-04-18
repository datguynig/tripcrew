"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { submitAiFeedback } from "@/lib/actions/aiDraft";
import type { AiFeedbackSurface } from "@/lib/types";

/**
 * Dismissable thumbs up/down + optional note card, shown below an
 * AI-drafted section. Feeds into the `ai_feedback` table so we can
 * tune prompts between beta weeks based on what's landing badly.
 *
 * Voluntary — user can dismiss without voting and the card stays
 * hidden for the current session (local state only, not persisted).
 */

type Props = {
  tripId: string;
  surface: AiFeedbackSurface;
  label?: string;
};

export function AIFeedbackCard({
  tripId,
  surface,
  label = "How's this AI draft?",
}: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [voted, setVoted] = useState<1 | -1 | null>(null);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  if (dismissed) return null;

  const handleVote = (rating: 1 | -1) => {
    setVoted(rating);
    startTransition(async () => {
      const res = await submitAiFeedback({
        tripId,
        surface,
        rating,
        note: null,
      });
      if (res?.error) {
        toast.error(res.error);
        setVoted(null);
        return;
      }
      setNoteOpen(true);
    });
  };

  const handleNote = () => {
    if (!note.trim()) {
      setDismissed(true);
      return;
    }
    startTransition(async () => {
      const res = await submitAiFeedback({
        tripId,
        surface,
        rating: voted,
        note: note.trim(),
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Thanks — noted.");
      setDismissed(true);
    });
  };

  return (
    <div className="mt-4 border border-line bg-bg-2/50 p-4 flex items-center gap-4 flex-wrap">
      <div className="label-sm text-fg-3 shrink-0">{label}</div>

      {voted === null && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleVote(1)}
            disabled={pending}
            className="h-[30px] px-3 rounded-[4px] border border-line text-fg-2 hover:border-ok hover:text-ok text-[13px] font-medium transition-colors cursor-pointer"
            aria-label="Good draft"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => handleVote(-1)}
            disabled={pending}
            className="h-[30px] px-3 rounded-[4px] border border-line text-fg-2 hover:border-err hover:text-err text-[13px] font-medium transition-colors cursor-pointer"
            aria-label="Poor draft"
          >
            ↓
          </button>
        </div>
      )}

      {noteOpen && (
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What missed?"
            maxLength={500}
            className="flex-1 bg-bg-2 border border-line px-3 py-[6px] text-[13px] rounded-md focus:border-line-2 outline-none placeholder:text-fg-3"
          />
          <Button variant="ghost" size="sm" onClick={handleNote} disabled={pending}>
            {note.trim() ? "Send" : "Skip"}
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-auto text-fg-3 hover:text-fg text-[13px] cursor-pointer"
        aria-label="Dismiss feedback card"
      >
        ✕
      </button>
    </div>
  );
}
