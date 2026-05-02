"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addExpense, deleteExpense, dismissMigrationWarning } from "@/lib/actions/ledger";
import { getFxSuggestionAction } from "@/lib/actions/fx";
import type { Expense, ExpenseParticipant, ShareBasis } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { currencySymbol } from "@/lib/currency";
import { INPUT_SM } from "@/lib/styles";
import { CurrencySection } from "./CurrencySection";
import { SplitSection, type SplitState } from "./SplitSection";
import { ExpenseRow } from "./ExpenseRow";
import {
  computeEqualShares,
  computePercentageShares,
  computeExactShares,
} from "@/lib/ledger/shares";

type CrewOption = { id: string; name: string };

type PhantomWarning = {
  shown?: boolean;
  target_crew_size?: number;
  joined_count?: number;
} | null;

type Props = {
  initial: Expense[];
  participants: ExpenseParticipant[];
  crew: CrewOption[];
  tripId: string;
  currentUserId: string;
  isAdmin: boolean;
  currency: string | null;
  targetCrewSize: number | null;
  phantomWarning: PhantomWarning;
};

type FxState = {
  original_currency: string;
  original_amount: number | null;
  trip_amount: number | null;
  fx_rate: number | null;
  fx_rate_date: string | null;
  fx_rate_source: "frankfurter" | "manual";
  fx_user_overridden: boolean;
};

const initialFxState: FxState = {
  original_currency: "EUR",
  original_amount: null,
  trip_amount: null,
  fx_rate: null,
  fx_rate_date: null,
  fx_rate_source: "frankfurter",
  fx_user_overridden: false,
};

function buildInitialSplitState(crew: CrewOption[]): SplitState {
  return {
    basis: "equal" as ShareBasis,
    participants: crew.map((c) => ({ user_id: c.id, included: true })),
  };
}

export function Ledger({
  initial,
  participants: initialParticipants,
  crew,
  tripId,
  currentUserId,
  isAdmin,
  currency,
  targetCrewSize,
  phantomWarning,
}: Props) {
  const symbol = currencySymbol(currency);
  const tripCurrency = currency ?? "GBP";
  const [expenses, setExpenses] = useState<Expense[]>(initial);
  const [participants, setParticipants] = useState<ExpenseParticipant[]>(initialParticipants);
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [fxEnabled, setFxEnabled] = useState(false);
  const [fxState, setFxState] = useState<FxState>(initialFxState);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitState, setSplitState] = useState<SplitState>(() => buildInitialSplitState(crew));
  const [showDeleted, setShowDeleted] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => setExpenses(initial), [initial]);
  useEffect(() => setParticipants(initialParticipants), [initialParticipants]);
  useEffect(() => {
    setSplitState((prev) => {
      // Re-init split participants when crew membership changes (additions / departures).
      // Preserve existing inclusion + input where the user_id still matches.
      const existing = new Map(prev.participants.map((p) => [p.user_id, p]));
      return {
        ...prev,
        participants: crew.map((c) =>
          existing.get(c.id) ?? { user_id: c.id, included: true },
        ),
      };
    });
  }, [crew]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("rt:expenses")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setExpenses((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Expense;
              if (prev.some((e) => e.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Partial<Expense> & { id: string };
              return prev.map((e) => (e.id === row.id ? { ...e, ...row } : e));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((e) => e.id !== row.id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expense_participants",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setParticipants((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as ExpenseParticipant;
              if (prev.some((p) => p.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Partial<ExpenseParticipant> & { id: string };
              return prev.map((p) => (p.id === row.id ? { ...p, ...row } : p));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((p) => p.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void supabase
          .from("expenses")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false })
          .returns<Expense[]>()
          .then(({ data }) => {
            if (data) setExpenses(data);
          });
        void supabase
          .from("expense_participants")
          .select("*")
          .eq("trip_id", tripId)
          .is("deleted_at", null)
          .returns<ExpenseParticipant[]>()
          .then(({ data }) => {
            if (data) setParticipants(data);
          });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of crew) m.set(c.id, c.name);
    return m;
  }, [crew]);

  const visibleExpenses = useMemo(
    () => (showDeleted ? expenses : expenses.filter((e) => !e.deleted_at)),
    [expenses, showDeleted],
  );

  const total = useMemo(
    () =>
      expenses
        .filter((e) => !e.deleted_at)
        .reduce((s, e) => s + Number(e.amount), 0),
    [expenses],
  );
  const splitCountForLegacyDisplay =
    targetCrewSize && targetCrewSize > 0 ? targetCrewSize : crew.length;
  const perPerson =
    splitCountForLegacyDisplay > 0 ? total / splitCountForLegacyDisplay : 0;
  const myTotal = useMemo(
    () =>
      expenses
        .filter((e) => !e.deleted_at && e.paid_by === currentUserId)
        .reduce((s, e) => s + Number(e.amount), 0),
    [expenses, currentUserId],
  );

  const balances = useMemo(() => {
    const paid = new Map<string, number>();
    const owed = new Map<string, number>();
    for (const c of crew) {
      paid.set(c.id, 0);
      owed.set(c.id, 0);
    }
    for (const e of expenses) {
      if (e.deleted_at) continue;
      paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + Number(e.amount));
    }
    for (const p of participants) {
      if (p.deleted_at) continue;
      owed.set(p.user_id, (owed.get(p.user_id) ?? 0) + Number(p.share_amount));
    }
    return crew.map((c) => ({
      id: c.id,
      name: c.name,
      net: (paid.get(c.id) ?? 0) - (owed.get(c.id) ?? 0),
    }));
  }, [expenses, participants, crew]);

  const participantsByExpense = useMemo(() => {
    const m = new Map<string, ExpenseParticipant[]>();
    for (const p of participants) {
      if (p.deleted_at) continue;
      const arr = m.get(p.expense_id) ?? [];
      arr.push(p);
      m.set(p.expense_id, arr);
    }
    return m;
  }, [participants]);

  const handleAdd = () => {
    const description = desc.trim();
    const amount = parseFloat(amt);
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    const rounded = Math.round(amount * 100) / 100;

    // Build participants if SplitSection enabled; otherwise default = even split (action handles).
    let participantsInput:
      | { user_id: string; share_amount: number; share_basis: ShareBasis; share_input: number | null }[]
      | undefined;
    if (splitEnabled) {
      const included = splitState.participants.filter((p) => p.included);
      if (included.length === 0) {
        toast.error("Pick at least one participant.");
        return;
      }
      let shares;
      if (splitState.basis === "equal") {
        shares = computeEqualShares(rounded, included.map((p) => p.user_id));
      } else if (splitState.basis === "percentage") {
        const sum = included.reduce((s, p) => s + (p.input ?? 0), 0);
        if (Math.abs(sum - 100) > 0.01) {
          toast.error("Percentages must sum to 100.");
          return;
        }
        shares = computePercentageShares(
          rounded,
          included.map((p) => ({ user_id: p.user_id, input: p.input ?? 0 })),
        );
      } else {
        const sum = included.reduce((s, p) => s + (p.input ?? 0), 0);
        if (Math.abs(sum - rounded) > 0.01) {
          toast.error(`Shares must sum to ${rounded.toFixed(2)}.`);
          return;
        }
        shares = computeExactShares(
          included.map((p) => ({ user_id: p.user_id, input: p.input ?? 0 })),
        );
      }
      participantsInput = shares.map((s) => ({
        user_id: s.user_id,
        share_amount: s.share_amount,
        share_basis: s.share_basis,
        share_input: s.share_input,
      }));
    }

    // FX payload
    const fxPayload = fxEnabled && fxState.original_amount && fxState.trip_amount
      ? {
          original_currency: fxState.original_currency,
          original_amount: fxState.original_amount,
          fx_rate:
            fxState.original_amount > 0
              ? Math.round((fxState.trip_amount / fxState.original_amount) * 1_000_000) / 1_000_000
              : null,
          fx_rate_source: fxState.fx_rate_source,
          fx_rate_date: fxState.fx_rate_date,
          fx_suggested_amount: fxState.fx_user_overridden ? null : fxState.trip_amount,
          fx_user_overridden: fxState.fx_user_overridden,
        }
      : {};

    const finalAmount =
      fxEnabled && fxState.trip_amount ? fxState.trip_amount : rounded;

    setDesc("");
    setAmt("");
    setFxEnabled(false);
    setFxState(initialFxState);
    setSplitEnabled(false);
    setSplitState(buildInitialSplitState(crew));

    startTransition(async () => {
      const result = await addExpense({
        tripId,
        description,
        amount: finalAmount,
        ...fxPayload,
        participants: participantsInput,
      });
      if (result?.error) toast.error(result.error);
    });
  };

  const handleDelete = (id: string) => {
    const removed = expenses.find((e) => e.id === id);
    if (!removed) return;
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, deleted_at: new Date().toISOString() } : e,
      ),
    );
    toast.undo({
      message: `Deleted "${removed.description}"`,
      duration: 5000,
      onUndo: () =>
        setExpenses((prev) =>
          prev.map((e) => (e.id === id ? { ...e, deleted_at: null } : e)),
        ),
      onCommit: () =>
        startTransition(async () => {
          await deleteExpense(id);
        }),
    });
  };

  const handleEdit = (_id: string) => {
    toast.error("Edit not available yet");
  };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    startTransition(async () => {
      await dismissMigrationWarning(tripId);
    });
  };

  const showBanner =
    phantomWarning &&
    phantomWarning.shown !== true &&
    !bannerDismissed &&
    typeof phantomWarning.target_crew_size === "number" &&
    typeof phantomWarning.joined_count === "number";

  const affectedCount = useMemo(
    () =>
      expenses.filter((e) => !e.deleted_at).length,
    [expenses],
  );


  return (
    <>
      {showBanner && (
        <div className="border border-warn/40 bg-warn/5 px-5 py-4 mb-6 flex items-start justify-between gap-4 max-[640px]:flex-col">
          <div className="flex-1 min-w-0">
            <div className="label-sm-wide text-warn mb-1">LEDGER UPDATE</div>
            <p className="text-[13px] text-fg-2 leading-[1.5]">
              We moved your ledger to a new model. {affectedCount} legacy expense{affectedCount === 1 ? "" : "s"} split across {phantomWarning.target_crew_size} crew but only {phantomWarning.joined_count} joined. The unallocated portion sits as a payer-side credit. Invite the missing crew or accept the gap.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={handleDismissBanner}>Dismiss</Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 max-[780px]:grid-cols-1 border border-line mb-7">
        <div className="p-[22px] px-6 border-r border-line max-[780px]:border-r-0 max-[780px]:border-b last:border-r-0 max-[780px]:last:border-b-0">
          <div className="label-sm-wide text-fg-3 mb-[10px]">Total pooled</div>
          <div className="text-4xl max-[520px]:text-3xl font-medium tracking-[-0.03em] leading-none tabular-nums">
            <span className="text-fg-3 text-lg font-normal">{symbol}</span>
            {Math.round(total).toLocaleString()}
          </div>
        </div>
        <div className="p-[22px] px-6 border-r border-line max-[780px]:border-r-0 max-[780px]:border-b last:border-r-0 max-[780px]:last:border-b-0">
          <div className="label-sm-wide text-fg-3 mb-[10px]">Even split</div>
          <div className="text-4xl max-[520px]:text-3xl font-medium tracking-[-0.03em] leading-none tabular-nums">
            <span className="text-fg-3 text-lg font-normal">{symbol}</span>
            {Math.round(perPerson).toLocaleString()}
          </div>
        </div>
        <div className="p-[22px] px-6">
          <div className="label-sm-wide text-fg-3 mb-[10px]">You&apos;ve covered</div>
          <div className="text-4xl max-[520px]:text-3xl font-medium tracking-[-0.03em] leading-none tabular-nums">
            <span className="text-fg-3 text-lg font-normal">{symbol}</span>
            {Math.round(myTotal).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid gap-3 mb-5">
        <div className="grid grid-cols-[1fr_160px_auto] max-[520px]:grid-cols-1 gap-2">
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What was it for..."
            className={INPUT_SM}
          />
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={`Amount (${symbol})`}
            className={INPUT_SM}
          />
          <Button onClick={handleAdd}>Log</Button>
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
          total={fxEnabled && fxState.trip_amount ? fxState.trip_amount : parseFloat(amt) || 0}
          crew={crew}
          enabled={splitEnabled}
          onToggle={setSplitEnabled}
          value={splitState}
          onChange={setSplitState}
        />
      </div>

      {isAdmin && (
        <div className="flex items-baseline justify-end mb-2">
          <button
            type="button"
            onClick={() => setShowDeleted((v) => !v)}
            className="label-sm text-fg-3 hover:text-accent transition-colors"
          >
            {showDeleted ? "Hide deleted" : "Show deleted"}
          </button>
        </div>
      )}

      {visibleExpenses.length === 0 ? (
        <div className="border border-line py-14 text-center label text-fg-3 mb-8">
          No expenses logged
        </div>
      ) : (
        <div className="border border-line mb-8">
          {visibleExpenses.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              participants={participantsByExpense.get(e.id) ?? []}
              payerName={nameById.get(e.paid_by) ?? "Unknown"}
              currency={tripCurrency}
              isMine={e.paid_by === currentUserId}
              isAdmin={isAdmin}
              totalCrew={crew.length}
              onDelete={() => handleDelete(e.id)}
              onEdit={() => handleEdit(e.id)}
            />
          ))}
        </div>
      )}

      {crew.length >= 2 && expenses.filter((e) => !e.deleted_at).length > 0 && (
        <div className="border border-line p-6">
          <div className="label-sm-wide text-fg-3 mb-4">
            Settlement · positive = owed back
          </div>
          {balances.map((b) => {
            const rounded = Math.round(Math.abs(b.net));
            const tone =
              b.net > 0 ? "text-ok" : b.net < 0 ? "text-err" : "text-fg-3";
            const label =
              b.net > 0
                ? `+${symbol}${rounded.toLocaleString()} back`
                : b.net < 0
                  ? `${symbol}${rounded.toLocaleString()} owed`
                  : `${symbol}0 even`;
            return (
              <div
                key={b.id}
                className="grid grid-cols-[1fr_auto] py-3 border-b border-line last:border-b-0 items-baseline"
              >
                <div className="text-[15px] font-medium tracking-[-0.01em]">
                  {b.name}
                </div>
                <div
                  className={`font-mono text-[13px] tracking-[0.02em] tabular-nums ${tone}`}
                >
                  {label}
                </div>
              </div>
            );
          })}
          <div className="font-mono text-[11px] text-fg-3 tracking-[0.05em] uppercase mt-[14px]">
            Maths runs on per-expense participant shares.
          </div>
        </div>
      )}
    </>
  );
}
