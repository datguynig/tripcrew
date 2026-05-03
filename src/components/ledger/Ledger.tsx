"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addExpense, deleteExpense, dismissMigrationWarning } from "@/lib/actions/ledger";
import { getFxSuggestionAction } from "@/lib/actions/fx";
import type {
  Expense,
  ExpenseParticipant,
  Payment,
  PaymentObligation,
  Schedule,
  ShareBasis,
} from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { currencySymbol } from "@/lib/currency";
import { INPUT_SM } from "@/lib/styles";
import { CurrencySection } from "./CurrencySection";
import { SplitSection, type SplitState } from "./SplitSection";
import { ExpenseRow } from "./ExpenseRow";
import { EditExpenseDialog } from "./EditExpenseDialog";
import { SchedulePaybackSection } from "./SchedulePaybackSection";
import { ScheduleView } from "./ScheduleView";
import { ReissuedPanel } from "./ReissuedPanel";

type CrewOption = { id: string; name: string };

type PhantomWarning = {
  shown?: boolean;
  target_crew_size?: number;
  joined_count?: number;
} | null;

type Props = {
  initial: Expense[];
  participants: ExpenseParticipant[];
  obligations: PaymentObligation[];
  payments: Payment[];
  crew: CrewOption[];
  tripId: string;
  currentUserId: string;
  isAdmin: boolean;
  currency: string | null;
  tripEndDate: string | null;
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
  obligations: initialObligations,
  payments: initialPayments,
  crew,
  tripId,
  currentUserId,
  isAdmin,
  currency,
  tripEndDate,
  phantomWarning,
}: Props) {
  const symbol = currencySymbol(currency);
  const tripCurrency = currency ?? "GBP";
  const [expenses, setExpenses] = useState<Expense[]>(initial);
  const [participants, setParticipants] = useState<ExpenseParticipant[]>(initialParticipants);
  const [obligations, setObligations] = useState<PaymentObligation[]>(initialObligations);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [fxEnabled, setFxEnabled] = useState(false);
  const [fxState, setFxState] = useState<FxState>(initialFxState);
  const [splitState, setSplitState] = useState<SplitState>(() => buildInitialSplitState(crew));
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleState, setScheduleState] = useState<Schedule>({ type: "none" });
  const [showDeleted, setShowDeleted] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"expenses" | "schedule">("expenses");
  const [, startTransition] = useTransition();
  const toast = useToast();

  useEffect(() => setExpenses(initial), [initial]);
  useEffect(() => setParticipants(initialParticipants), [initialParticipants]);
  useEffect(() => setObligations(initialObligations), [initialObligations]);
  useEffect(() => setPayments(initialPayments), [initialPayments]);
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
    const refetchPayments = () =>
      supabase
        .from("payments")
        .select("*, payment_obligations!inner(trip_id)")
        .eq("payment_obligations.trip_id", tripId)
        .returns<Payment[]>()
        .then(({ data }) => {
          if (data) setPayments(data);
        });

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_obligations",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setObligations((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as PaymentObligation;
              if (prev.some((o) => o.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Partial<PaymentObligation> & { id: string };
              return prev.map((o) => (o.id === row.id ? { ...o, ...row } : o));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((o) => o.id !== row.id);
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
          table: "payments",
        },
        () => {
          void refetchPayments();
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
        void supabase
          .from("payment_obligations")
          .select("*")
          .eq("trip_id", tripId)
          .returns<PaymentObligation[]>()
          .then(({ data }) => {
            if (data) setObligations(data);
          });
        void refetchPayments();
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

  const paymentsByObligationId = useMemo(() => {
    const m = new Map<string, Payment[]>();
    for (const p of payments) {
      const arr = m.get(p.obligation_id) ?? [];
      arr.push(p);
      m.set(p.obligation_id, arr);
    }
    return m;
  }, [payments]);

  // Orphans: superseded obligations with active payments still attached
  // and no superseded_by back-link. ReissuedPanel surfaces these for admins
  // to void or reconcile.
  const orphans = useMemo(() => {
    const out: { obligation: PaymentObligation; activeTotal: number; payments: Payment[] }[] = [];
    for (const o of obligations) {
      if (o.status !== "superseded" || o.superseded_by) continue;
      const ps = paymentsByObligationId.get(o.id) ?? [];
      const activePayments = ps.filter((p) => p.status === "pending" || p.status === "verified");
      const activeTotal = activePayments
        .reduce((s, p) => s + Number(p.amount), 0);
      if (activePayments.length > 0) {
        out.push({ obligation: o, activeTotal, payments: activePayments });
      }
    }
    return out;
  }, [obligations, paymentsByObligationId]);

  const handleAdd = () => {
    const description = desc.trim();
    const amount = parseFloat(amt);
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    const rounded = Math.round(amount * 100) / 100;
    const finalAmount =
      fxEnabled && fxState.trip_amount
        ? Math.round(fxState.trip_amount * 100) / 100
        : rounded;

    // Build participants from the always-visible split section. The server
    // recomputes share_amount from (share_basis, share_input); client checks
    // run first for fast feedback. When the split is the default (equal +
    // all crew included), we omit participants and let the server compute
    // the even split — same wire shape as the pre-Phase-1 default path.
    let participantsInput:
      | { user_id: string; share_basis: ShareBasis; share_input: number | null }[]
      | undefined;
    const isDefaultSplit =
      splitState.basis === "equal" &&
      splitState.participants.length > 0 &&
      splitState.participants.every((p) => p.included);
    if (!isDefaultSplit) {
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
        if (Math.abs(sum - finalAmount) > 0.01) {
          toast.error(`Shares must sum to ${finalAmount.toFixed(2)}.`);
          return;
        }
        participantsInput = included.map((p) => ({
          user_id: p.user_id,
          share_basis: "exact" as ShareBasis,
          share_input: p.input ?? 0,
        }));
      }
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

    const schedulePayload = scheduleEnabled ? scheduleState : undefined;

    setDesc("");
    setAmt("");
    setFxEnabled(false);
    setFxState(initialFxState);
    setSplitState(buildInitialSplitState(crew));
    setScheduleEnabled(false);
    setScheduleState({ type: "none" });

    startTransition(async () => {
      const result = await addExpense({
        tripId,
        description,
        amount: finalAmount,
        ...fxPayload,
        participants: participantsInput,
        schedule: schedulePayload,
      });
      if (result?.error) toast.error(result.error);
    });
  };

  const handleDelete = (id: string) => {
    const removed = expenses.find((e) => e.id === id);
    if (!removed) return;
    // Mirror the server's shared-timestamp pattern in deleteExpense so paid
    // and owed totals stay aligned during the undo window. The timestamp
    // also scopes the undo restore: we only un-soft-delete participant rows
    // whose deleted_at matches this exact stamp, leaving any pre-existing
    // soft-deleted participants alone.
    const ts = new Date().toISOString();
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, deleted_at: ts } : e)),
    );
    setParticipants((prev) =>
      prev.map((p) =>
        p.expense_id === id && !p.deleted_at ? { ...p, deleted_at: ts } : p,
      ),
    );
    toast.undo({
      message: `Deleted "${removed.description}"`,
      duration: 5000,
      onUndo: () => {
        setExpenses((prev) =>
          prev.map((e) => (e.id === id ? { ...e, deleted_at: null } : e)),
        );
        setParticipants((prev) =>
          prev.map((p) =>
            p.expense_id === id && p.deleted_at === ts
              ? { ...p, deleted_at: null }
              : p,
          ),
        );
      },
      onCommit: () =>
        startTransition(async () => {
          await deleteExpense(id);
        }),
    });
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const editingExpense = useMemo(
    () => (editingId ? expenses.find((e) => e.id === editingId) ?? null : null),
    [editingId, expenses],
  );
  const editingParticipants = useMemo(
    () =>
      editingId
        ? participants.filter((p) => p.expense_id === editingId && !p.deleted_at)
        : [],
    [editingId, participants],
  );

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
      <ReissuedPanel orphans={orphans} isAdmin={isAdmin} />

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

      {(() => {
        const myNet = balances.find((b) => b.id === currentUserId)?.net ?? 0;
        const positionTone =
          myNet > 0.005 ? "text-ok" : myNet < -0.005 ? "text-err" : "text-fg-3";
        const positionAbs = Math.round(Math.abs(myNet)).toLocaleString();
        const positionDisplay =
          Math.abs(myNet) < 0.005
            ? "Even"
            : `${myNet > 0 ? "+" : "-"}${symbol}${positionAbs}`;
        const activeCount = expenses.filter((e) => !e.deleted_at).length;
        const lastIso = expenses.find((e) => !e.deleted_at)?.created_at;
        const lastLabel = lastIso
          ? new Date(lastIso)
              .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
              .toUpperCase()
          : "NEVER";
        return (
          <div className="border border-line mb-7">
            <div className="px-6 py-[22px] grid grid-cols-[auto_1fr] gap-x-6 items-baseline max-[520px]:grid-cols-1 max-[520px]:gap-y-1">
              <div className="label-sm-wide text-fg-3">YOUR POSITION</div>
              <div
                className={`text-4xl max-[520px]:text-3xl font-medium tracking-[-0.03em] leading-none tabular-nums justify-self-end max-[520px]:justify-self-start ${positionTone}`}
              >
                {positionDisplay}
              </div>
            </div>
            <div className="border-t border-line px-6 py-[10px] flex items-baseline gap-3 flex-wrap font-mono text-[11px] text-fg-3 tracking-[0.05em] uppercase">
              <span className="tabular-nums">
                {symbol}
                {Math.round(total).toLocaleString()} pooled
              </span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {activeCount} {activeCount === 1 ? "expense" : "expenses"}
              </span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">last log {lastLabel}</span>
            </div>
          </div>
        );
      })()}

      <div className="flex gap-2 mb-5 font-mono text-[11px] uppercase tracking-[0.1em]">
        <button
          type="button"
          onClick={() => setActiveTab("expenses")}
          className={`px-3 py-2 border transition-colors ${
            activeTab === "expenses"
              ? "border-accent text-accent"
              : "border-line text-fg-3 hover:border-line-2 hover:text-fg"
          }`}
        >
          Expenses
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`px-3 py-2 border transition-colors ${
            activeTab === "schedule"
              ? "border-accent text-accent"
              : "border-line text-fg-3 hover:border-line-2 hover:text-fg"
          }`}
        >
          Schedule
        </button>
      </div>

      {activeTab === "expenses" && (
      <>
      <div className="label-sm-wide text-fg-3 mb-3">LOG AN EXPENSE</div>
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
          enabled
          onToggle={() => {}}
          value={splitState}
          onChange={setSplitState}
          collapsible={false}
        />
        <SchedulePaybackSection
          enabled={scheduleEnabled}
          onToggle={setScheduleEnabled}
          value={scheduleState}
          onChange={setScheduleState}
          tripEndDate={tripEndDate}
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
        <div className="border border-line py-14 text-center font-mono text-[11px] text-fg-3 tracking-[0.08em] uppercase mb-8">
          NO EXPENSES YET
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
          {(() => {
            const unallocated = balances.reduce((s, b) => s + b.net, 0);
            if (unallocated < 0.005) return null;
            return (
              <div className="border-t border-line pt-3 mt-1 grid grid-cols-[1fr_auto] items-baseline">
                <div className="text-[13px] text-fg-2 tracking-[-0.01em]">
                  Unallocated to unjoined crew
                </div>
                <div className="font-mono text-[13px] tracking-[0.02em] tabular-nums text-warn">
                  {symbol}
                  {Math.round(unallocated).toLocaleString()}
                </div>
              </div>
            );
          })()}
          <div className="font-mono text-[11px] text-fg-3 tracking-[0.05em] uppercase mt-[14px]">
            Per expense participant shares. Phantom shares preserved as payer credit.
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === "schedule" && (
        <ScheduleView
          obligations={obligations}
          paymentsByObligationId={paymentsByObligationId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          currency={tripCurrency}
        />
      )}

      {editingExpense && (
        <EditExpenseDialog
          open={!!editingId}
          onOpenChange={(o) => {
            if (!o) setEditingId(null);
          }}
          expense={editingExpense}
          participants={editingParticipants}
          crew={crew}
          tripCurrency={tripCurrency}
        />
      )}
    </>
  );
}
