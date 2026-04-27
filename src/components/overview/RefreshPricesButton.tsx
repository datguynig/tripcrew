"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { refreshPrices } from "@/lib/actions/priceRefresh";

type Props = {
  tripId: string;
  userId: string;
  lastRefreshedAt: string | null;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RefreshPricesButton({
  tripId,
  userId,
  lastRefreshedAt,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [optimisticAt, setOptimisticAt] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const stamp = optimisticAt ?? lastRefreshedAt;

  const handleClick = () => {
    setUpgradeError(null);
    startTransition(async () => {
      const result = await refreshPrices(userId, tripId);
      if (result.success) {
        setOptimisticAt(result.refreshedAt);
        toast.success("Refresh logged.");
        router.refresh();
        return;
      }
      if (result.upgradeCta) {
        setUpgradeError(result.error);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClick}
          disabled={pending}
        >
          {pending ? "Refreshing…" : "Refresh check"}
        </Button>
        <span className="label-sm text-fg-3">
          {stamp ? `Last checked ${formatRelative(stamp)}` : "Not yet checked"}
        </span>
      </div>
      <p className="text-[12px] text-fg-3 leading-[1.5] max-w-[440px]">
        Stub for now — logs a refresh timestamp. Live flight + hotel pricing
        ships in a later beta.
      </p>
      {upgradeError && (
        <div className="border border-accent/30 bg-accent/[0.06] px-4 py-3 flex items-center gap-4 flex-wrap text-[13px]">
          <span className="text-fg-2">{upgradeError}</span>
          <Link
            href="/account"
            className="label-sm-wide text-accent hover:underline shrink-0"
          >
            Upgrade →
          </Link>
        </div>
      )}
    </div>
  );
}
