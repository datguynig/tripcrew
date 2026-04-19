"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { rerollRow } from "@/lib/actions/aiDraft";

type Props = {
  tripId: string;
  surface: "activities" | "bookings";
  rowId: string;
  disabled?: boolean;
  blockedReason?: string | null;
};

export function RerollButton({
  tripId,
  surface,
  rowId,
  disabled = false,
  blockedReason = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const handleClick = () => {
    if (disabled || pending || running) return;
    setRunning(true);
    startTransition(async () => {
      const res = await rerollRow({ tripId, surface, rowId });
      setRunning(false);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Re-rolled.");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending || running}
      aria-label="Suggest another"
      title={
        disabled && blockedReason
          ? blockedReason
          : running
            ? "Re-rolling…"
            : "Suggest another"
      }
      className={`w-[20px] h-[20px] flex items-center justify-center font-mono text-[11px] transition-colors cursor-pointer disabled:cursor-not-allowed ${
        running
          ? "text-accent"
          : disabled
            ? "text-fg-4"
            : "text-fg-3 hover:text-accent"
      }`}
    >
      {running ? (
        <span
          className="w-[5px] h-[5px] rounded-full bg-accent animate-pulse"
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true">↻</span>
      )}
    </button>
  );
}
