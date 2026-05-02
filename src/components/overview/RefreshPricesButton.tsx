"use client";

import { useState, useTransition } from "react";
import { refreshPrices } from "@/lib/actions/priceRefresh";
import { useToast } from "@/hooks/useToast";

const RATE_LIMIT_HOURS = 4;

type Props = {
  userId: string;
  tripId: string;
  lastPriceRefreshAt: string | null;
  onRefreshed?: (refreshedAt: string) => void;
};

function formatRateLimitCopy(lastIso: string | null): string | null {
  if (!lastIso) return null;
  const elapsedMs = Date.now() - Date.parse(lastIso);
  const remainingMs = RATE_LIMIT_HOURS * 3_600_000 - elapsedMs;
  if (remainingMs <= 0) return null;
  const h = Math.floor(remainingMs / 3_600_000);
  const m = Math.floor((remainingMs % 3_600_000) / 60_000);
  return h > 0 ? `Try in ${h}h ${m}m` : `Try in ${m}m`;
}

export function RefreshPricesButton({
  userId,
  tripId,
  lastPriceRefreshAt,
  onRefreshed,
}: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [lastAt, setLastAt] = useState(lastPriceRefreshAt);
  const rateLimited = formatRateLimitCopy(lastAt);
  const disabled = pending || !!rateLimited;

  const handleClick = () => {
    if (disabled) return;
    startTransition(async () => {
      const result = await refreshPrices(userId, tripId);
      if (result.success) {
        setLastAt(result.refreshedAt);
        toast.success("Prices refreshed.");
        onRefreshed?.(result.refreshedAt);
      } else {
        toast.error(result.error);
      }
    });
  };

  let label: string;
  if (pending) label = "Refreshing…";
  else if (rateLimited) label = rateLimited;
  else label = "Refresh";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-[10px] py-[6px]
        label-sm border border-line bg-bg-2 text-fg
        hover:border-line-2 hover:bg-bg-3
        disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-bg-2 disabled:hover:border-line
        transition-colors"
      aria-busy={pending}
    >
      <RefreshIcon spinning={pending} />
      <span>{label}</span>
    </button>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : undefined}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
