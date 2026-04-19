"use client";

import { useEffect, useState } from "react";
import { AIDraftBadge } from "@/components/overview/AIDraftBadge";
import { AIDraftRail } from "@/components/overview/AIDraftRail";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { InlineMoneyEdit } from "@/components/ui/InlineMoneyEdit";
import { InlineTextarea } from "@/components/ui/InlineTextarea";
import { updateSpecCell } from "@/lib/actions/overviewInline";
import { useToast } from "@/hooks/useToast";
import { DEFAULT_SPEC_LABELS } from "@/lib/constants";
import type { SpecItem } from "@/lib/types";

type AiRail = {
  tripId: string;
  destination: string;
  draftedAt: string | null;
  canRedraft: boolean;
  blockedReason: string | null;
};

type Props = {
  cells: SpecItem[];
  isAdmin?: boolean;
  tripId: string;
  tripSlug?: string;
  currency: string;
  aiDrafted?: boolean;
  aiRail?: AiRail;
};

export function SpecGrid({
  cells,
  isAdmin,
  tripId,
  currency,
  aiDrafted = false,
  aiRail,
}: Props) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useState<SpecItem[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Drop the optimistic overlay once the server's revalidated cells
  // land. Same reasoning as Schedule — avoids a visible flicker back
  // to the stale prop between optimistic-clear and RSC re-render.
  useEffect(() => {
    setOptimistic(null);
  }, [cells]);

  const displayed: SpecItem[] =
    optimistic ??
    (cells.length > 0
      ? cells
      : isAdmin
        ? DEFAULT_SPEC_LABELS.map((label) => ({ label, value: "", sub: "" }))
        : []);

  if (displayed.length === 0) {
    return (
      <div className="border border-line py-14 text-center mb-9">
        <div className="label-sm-wide text-fg-3">
          Spec grid · details coming soon
        </div>
      </div>
    );
  }

  const commit = async (
    index: number,
    patch: { value?: string; sub?: string; amount?: number | null },
  ): Promise<boolean> => {
    const prev = displayed;
    const next = prev.map((c, i): SpecItem => {
      if (i !== index) return c;
      const merged: SpecItem = { ...c, ...patch };
      if (typeof patch.amount !== "undefined" && patch.amount !== null) {
        merged.value = patch.amount.toLocaleString("en-US");
      }
      return merged;
    });
    setOptimistic(next);
    const res = await updateSpecCell({ tripId, index, patch });
    if (res?.error) {
      setOptimistic(prev);
      toast.error(res.error);
      return false;
    }
    return true;
  };

  return (
    <div className="mb-9">
      {aiDrafted && aiRail ? (
        <AIDraftRail
          tripId={aiRail.tripId}
          destination={aiRail.destination}
          surface="spec_grid"
          draftedAt={aiRail.draftedAt}
          isAdmin={!!isAdmin}
          canRedraft={aiRail.canRedraft}
          blockedReason={aiRail.blockedReason}
        />
      ) : aiDrafted ? (
        <div className="flex justify-end mb-2">
          <AIDraftBadge />
        </div>
      ) : null}

      <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1 border border-line">
        {displayed.map((cell, i) => {
          const isMoney = typeof cell.amount === "number";
          const dim =
            editingIndex !== null && editingIndex !== i
              ? "opacity-40 transition-opacity"
              : "transition-opacity";

          return (
            <div
              key={`${cell.label}-${i}`}
              className={`py-[22px] px-6 border-r border-b border-line ${
                i % 4 === 3 ? "border-r-0" : ""
              } ${
                i >= displayed.length - (displayed.length % 4 || 4)
                  ? "last:border-b-0"
                  : ""
              } max-[900px]:[&:nth-child(2n)]:border-r-0 max-[900px]:[&:nth-last-child(-n+2)]:border-b-0 max-[520px]:border-r-0 max-[520px]:last:border-b-0 ${dim}`}
            >
              <div className="label-sm-wide text-fg-3 mb-3">{cell.label}</div>

              <div className="text-[22px] font-medium tracking-[-0.02em] leading-[1.2]">
                {isMoney || cell.label.toLowerCase() === "per head" ? (
                  <InlineMoneyEdit
                    amount={cell.amount ?? 0}
                    currency={currency}
                    onCommit={(next) => commit(i, { amount: next })}
                    editable={!!isAdmin}
                    ariaLabel={`Edit ${cell.label} amount`}
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                  />
                ) : (
                  <InlineEdit
                    value={cell.value}
                    onCommit={(next) => commit(i, { value: next })}
                    editable={!!isAdmin}
                    as="span"
                    maxLength={80}
                    ariaLabel={`Edit ${cell.label} value`}
                    emptyLabel="Add value"
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                    className="inline"
                  />
                )}
              </div>

              <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-3 mt-2">
                {cell.label.toLowerCase() === "the rule" ? (
                  <InlineTextarea
                    value={cell.sub}
                    onCommit={(next) => commit(i, { sub: next })}
                    editable={!!isAdmin}
                    maxLength={60}
                    ariaLabel={`Edit ${cell.label} detail`}
                    emptyLabel="Add detail"
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                    className="font-mono text-[10px] tracking-[0.15em] uppercase"
                  />
                ) : (
                  <InlineEdit
                    value={cell.sub}
                    onCommit={(next) => commit(i, { sub: next })}
                    editable={!!isAdmin}
                    as="span"
                    maxLength={60}
                    ariaLabel={`Edit ${cell.label} detail`}
                    emptyLabel="Add detail"
                    onEditingChange={(e) => setEditingIndex(e ? i : null)}
                    className="inline font-mono text-[10px] tracking-[0.15em] uppercase"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
