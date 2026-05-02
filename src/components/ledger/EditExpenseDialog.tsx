"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { INPUT_SM } from "@/lib/styles";
import { currencySymbol } from "@/lib/currency";
import { editExpense } from "@/lib/actions/ledger";
import { getFxSuggestionAction } from "@/lib/actions/fx";
import type { Expense, ExpenseParticipant, ShareBasis } from "@/lib/types";
import { CurrencySection } from "./CurrencySection";
import { SplitSection, type SplitState } from "./SplitSection";

type CrewOption = { id: string; name: string };

type FxState = {
  original_currency: string;
  original_amount: number | null;
  trip_amount: number | null;
  fx_rate: number | null;
  fx_rate_date: string | null;
  fx_rate_source: "frankfurter" | "manual";
  fx_user_overridden: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense;
  participants: ExpenseParticipant[];
  crew: CrewOption[];
  tripCurrency: string;
};

function deriveFxState(expense: Expense): FxState {
  const hasFx = !!expense.original_currency && !!expense.original_amount;
  return {
    original_currency: expense.original_currency ?? "EUR",
    original_amount: hasFx ? Number(expense.original_amount) : null,
    trip_amount: hasFx ? Number(expense.amount) : null,
    fx_rate: expense.fx_rate ? Number(expense.fx_rate) : null,
    fx_rate_date: expense.fx_rate_date ?? null,
    fx_rate_source:
      expense.fx_rate_source === "manual" ? "manual" : "frankfurter",
    fx_user_overridden: expense.fx_user_overridden ?? false,
  };
}

function deriveSplitState(
  participants: ExpenseParticipant[],
  crew: CrewOption[],
): { enabled: boolean; state: SplitState } {
  const active = participants.filter((p) => !p.deleted_at);
  const basis: ShareBasis = active[0]?.share_basis ?? "equal";
  const inputById = new Map<string, number | undefined>();
  for (const p of active) {
    inputById.set(
      p.user_id,
      p.share_input != null ? Number(p.share_input) : undefined,
    );
  }
  const includedIds = new Set(active.map((p) => p.user_id));
  // Treat as "even across full crew" only if every crew member is
  // included on equal basis; otherwise the user opted into custom split.
  const isPlainEvenAcrossCrew =
    basis === "equal" &&
    crew.length > 0 &&
    crew.every((c) => includedIds.has(c.id)) &&
    active.length === crew.length;
  return {
    enabled: !isPlainEvenAcrossCrew && active.length > 0,
    state: {
      basis,
      participants: crew.map((c) => ({
        user_id: c.id,
        included: includedIds.has(c.id),
        input: inputById.get(c.id),
      })),
    },
  };
}

export function EditExpenseDialog({
  open,
  onOpenChange,
  expense,
  participants,
  crew,
  tripCurrency,
}: Props) {
  const symbol = currencySymbol(tripCurrency);
  const initialFx = useMemo(() => deriveFxState(expense), [expense]);
  const initialSplit = useMemo(
    () => deriveSplitState(participants, crew),
    [participants, crew],
  );

  const [desc, setDesc] = useState(expense.description);
  const [amt, setAmt] = useState(String(Number(expense.amount).toFixed(2)));
  const [fxEnabled, setFxEnabled] = useState(
    !!expense.original_currency && !!expense.original_amount,
  );
  const [fxState, setFxState] = useState<FxState>(initialFx);
  const [splitEnabled, setSplitEnabled] = useState(initialSplit.enabled);
  const [splitState, setSplitState] = useState<SplitState>(initialSplit.state);
  const [, startTransition] = useTransition();
  const toast = useToast();

  // Re-prime when the dialog opens against a (possibly different) expense.
  useEffect(() => {
    if (!open) return;
    setDesc(expense.description);
    setAmt(String(Number(expense.amount).toFixed(2)));
    setFxEnabled(!!expense.original_currency && !!expense.original_amount);
    setFxState(deriveFxState(expense));
    const next = deriveSplitState(participants, crew);
    setSplitEnabled(next.enabled);
    setSplitState(next.state);
  }, [open, expense, participants, crew]);

  const handleSave = () => {
    const description = desc.trim();
    const amount = parseFloat(amt);
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Description and amount required.");
      return;
    }
    const rounded = Math.round(amount * 100) / 100;

    let participantsInput:
      | { user_id: string; share_basis: ShareBasis; share_input: number | null }[]
      | undefined;
    if (splitEnabled) {
      const included = splitState.participants.filter((p) => p.included);
      if (included.length === 0) {
        toast.error("Pick at least one participant.");
        return;
      }
      if (splitState.basis === "equal") {
        participantsInput = included.map((p) => ({
          user_id: p.user_id,
          share_basis: "equal" as ShareBasis,
          share_input: null,
        }));
      } else if (splitState.basis === "percentage") {
        const sum = included.reduce((s, p) => s + (p.input ?? 0), 0);
        if (Math.abs(sum - 100) > 0.01) {
          toast.error("Percentages must sum to 100.");
          return;
        }
        participantsInput = included.map((p) => ({
          user_id: p.user_id,
          share_basis: "percentage" as ShareBasis,
          share_input: p.input ?? 0,
        }));
      } else {
        const sum = included.reduce((s, p) => s + (p.input ?? 0), 0);
        if (Math.abs(sum - rounded) > 0.01) {
          toast.error(`Shares must sum to ${rounded.toFixed(2)}.`);
          return;
        }
        participantsInput = included.map((p) => ({
          user_id: p.user_id,
          share_basis: "exact" as ShareBasis,
          share_input: p.input ?? 0,
        }));
      }
    }

    const fxPayload =
      fxEnabled && fxState.original_amount && fxState.trip_amount
        ? {
            original_currency: fxState.original_currency,
            original_amount: fxState.original_amount,
            fx_rate:
              fxState.original_amount > 0
                ? Math.round(
                    (fxState.trip_amount / fxState.original_amount) * 1_000_000,
                  ) / 1_000_000
                : null,
            fx_rate_source: fxState.fx_rate_source,
            fx_rate_date: fxState.fx_rate_date,
            fx_suggested_amount: fxState.fx_user_overridden
              ? null
              : fxState.trip_amount,
            fx_user_overridden: fxState.fx_user_overridden,
          }
        : {
            original_currency: null,
            original_amount: null,
            fx_rate: null,
            fx_rate_source: null,
            fx_rate_date: null,
            fx_suggested_amount: null,
            fx_user_overridden: false,
          };

    const finalAmount =
      fxEnabled && fxState.trip_amount ? fxState.trip_amount : rounded;

    startTransition(async () => {
      const result = await editExpense({
        expenseId: expense.id,
        tripId: expense.trip_id,
        description,
        amount: finalAmount,
        ...fxPayload,
        participants: participantsInput,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,calc(100vw-32px))] max-h-[calc(100vh-64px)] overflow-y-auto">
        <DialogTitle>Edit expense</DialogTitle>
        <div className="grid gap-3 mb-5">
          <div className="grid grid-cols-[1fr_160px] max-[520px]:grid-cols-1 gap-2">
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What was it for..."
              className={INPUT_SM}
              aria-label="Description"
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              placeholder={`Amount (${symbol})`}
              className={INPUT_SM}
              aria-label="Amount"
            />
          </div>
          <CurrencySection
            tripCurrency={tripCurrency}
            enabled={fxEnabled}
            onToggle={setFxEnabled}
            value={fxState}
            onChange={setFxState}
            getFxSuggestion={getFxSuggestionAction}
          />
          <SplitSection
            total={
              fxEnabled && fxState.trip_amount
                ? fxState.trip_amount
                : parseFloat(amt) || 0
            }
            crew={crew}
            enabled={splitEnabled}
            onToggle={setSplitEnabled}
            value={splitState}
            onChange={setSplitState}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
