"use client";

import { useMemo } from "react";
import { INPUT_SM } from "@/lib/styles";
import {
  computeEqualShares,
  computePercentageShares,
  computeExactShares,
  type ComputedShare,
} from "@/lib/ledger/shares";
import type { ShareBasis } from "@/lib/types";

export type CrewOption = { id: string; name: string };
export type SplitState = {
  basis: ShareBasis;
  participants: { user_id: string; included: boolean; input?: number }[];
};

type Props = {
  total: number;
  crew: CrewOption[];
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  value: SplitState;
  onChange: (next: SplitState) => void;
  // When false, the section is always rendered expanded and the opt-in
  // pill is never shown. "Use even split" repurposes from "collapse" to
  // "reset to defaults" so it remains useful in always-on contexts.
  collapsible?: boolean;
};

export function SplitSection({
  total,
  crew,
  enabled,
  onToggle,
  value,
  onChange,
  collapsible = true,
}: Props) {
  const computed = useMemo<ComputedShare[]>(() => {
    const included = value.participants.filter((p) => p.included);
    if (included.length === 0) return [];
    if (value.basis === "equal") {
      return computeEqualShares(total, included.map((p) => p.user_id));
    }
    if (value.basis === "percentage") {
      return computePercentageShares(
        total,
        included.map((p) => ({ user_id: p.user_id, input: p.input ?? 0 })),
      );
    }
    return computeExactShares(
      included.map((p) => ({ user_id: p.user_id, input: p.input ?? 0 })),
    );
  }, [total, value]);

  const sumInputs = value.participants
    .filter((p) => p.included)
    .reduce((s, p) => s + (p.input ?? 0), 0);

  const sumShares = computed.reduce((s, c) => s + c.share_amount, 0);

  if (collapsible && !enabled) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        className="label-sm text-fg-3 hover:text-accent transition-colors"
      >
        + Customise split (otherwise even across crew)
      </button>
    );
  }

  const handleResetOrCollapse = () => {
    if (collapsible) {
      onToggle(false);
      return;
    }
    onChange({
      basis: "equal",
      participants: crew.map((c) => ({ user_id: c.id, included: true })),
    });
  };

  return (
    <div className="border border-line bg-bg-2 p-4 grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-sm-wide text-fg-3">SPLIT</div>
        <button
          type="button"
          onClick={handleResetOrCollapse}
          className="label-sm text-fg-3 hover:text-fg transition-colors"
        >
          Use even split
        </button>
      </div>

      <div className="flex gap-1">
        {(["equal", "percentage", "exact"] as ShareBasis[]).map((basis) => (
          <button
            key={basis}
            type="button"
            onClick={() => onChange({ ...value, basis })}
            className={`label-sm px-2 py-1 border ${
              value.basis === basis
                ? "border-accent text-accent"
                : "border-line text-fg-3 hover:border-line-2 hover:text-fg"
            } transition-colors`}
          >
            {basis}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        {value.participants.map((p, idx) => {
          const member = crew.find((c) => c.id === p.user_id);
          const computedShare = computed.find((c) => c.user_id === p.user_id);
          return (
            <label
              key={p.user_id}
              className={`grid gap-3 items-center text-[14px] ${
                p.included ? "" : "opacity-50"
              } ${
                value.basis === "exact"
                  ? "grid-cols-[20px_1fr_110px]"
                  : "grid-cols-[20px_1fr_90px_60px]"
              }`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={p.included}
                aria-label={p.included ? `Exclude ${member?.name ?? "Crew"}` : `Include ${member?.name ?? "Crew"}`}
                onClick={() => {
                  const next = value.participants.slice();
                  next[idx] = { ...p, included: !p.included };
                  onChange({ ...value, participants: next });
                }}
                className={`relative w-5 h-5 rounded border-[1.5px] cursor-pointer transition-colors ${
                  p.included
                    ? "bg-accent border-accent after:content-[''] after:absolute after:left-[5px] after:top-[1px] after:w-[6px] after:h-[11px] after:border-solid after:border-bg after:border-r-[2px] after:border-b-[2px] after:rotate-45"
                    : "bg-transparent border-fg-3 hover:border-fg"
                }`}
              />
              <span>{member?.name ?? "Crew"}</span>
              {value.basis !== "equal" ? (
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  disabled={!p.included}
                  value={p.input ?? ""}
                  onChange={(e) => {
                    const next = value.participants.slice();
                    next[idx] = {
                      ...p,
                      input: e.target.value === "" ? undefined : Number(e.target.value),
                    };
                    onChange({ ...value, participants: next });
                  }}
                  className={`${INPUT_SM} text-right`}
                  placeholder={value.basis === "percentage" ? "%" : "amount"}
                />
              ) : (
                <span className="text-fg-3 text-right tabular-nums">
                  {computedShare ? computedShare.share_amount.toFixed(2) : ""}
                </span>
              )}
              {value.basis !== "exact" && (
                <span className="text-fg-3 text-right tabular-nums text-[12px]">
                  {computedShare ? `${computedShare.share_amount.toFixed(2)}` : "."}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {value.basis === "percentage" && Math.abs(sumInputs - 100) > 0.01 && (
        <p className="text-[12px] text-err leading-[1.5]">
          Percentages must sum to 100. Currently {sumInputs.toFixed(2)}%.
        </p>
      )}
      {value.basis === "exact" && Math.abs(sumShares - total) > 0.01 && (
        <p className="text-[12px] text-err leading-[1.5]">
          Shares must sum to the total ({total.toFixed(2)}). Currently {sumShares.toFixed(2)}.
        </p>
      )}
    </div>
  );
}
