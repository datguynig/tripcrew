"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addExpense, deleteExpense } from "@/app/(app)/ledger/actions";
import type { Expense } from "@/lib/types";

type CrewOption = { id: string; name: string };

type Props = {
  initial: Expense[];
  crew: CrewOption[];
  tripId: string;
  currentUserId: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    .toUpperCase();
}

export function Ledger({ initial, crew, tripId, currentUserId }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initial);
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => setExpenses(initial), [initial]);

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
              const row = payload.new as Expense;
              return prev.map((e) => (e.id === row.id ? row : e));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id?: string };
              return prev.filter((e) => e.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of crew) m.set(c.id, c.name);
    return m;
  }, [crew]);

  const total = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses],
  );
  const perPerson = crew.length > 0 ? total / crew.length : 0;
  const myTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.paid_by === currentUserId)
        .reduce((s, e) => s + Number(e.amount), 0),
    [expenses, currentUserId],
  );

  const balances = useMemo(() => {
    const paid = new Map<string, number>();
    for (const c of crew) paid.set(c.id, 0);
    for (const e of expenses) {
      paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + Number(e.amount));
    }
    const share = crew.length > 0 ? total / crew.length : 0;
    return crew.map((c) => ({
      id: c.id,
      name: c.name,
      net: (paid.get(c.id) ?? 0) - share,
    }));
  }, [expenses, crew, total]);

  const handleAdd = () => {
    const description = desc.trim();
    const amount = parseFloat(amt);
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    const rounded = Math.round(amount * 100) / 100;
    setDesc("");
    setAmt("");
    startTransition(async () => {
      await addExpense({ description, amount: rounded });
    });
  };

  const handleDelete = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      await deleteExpense(id);
    });
  };

  return (
    <>
      <div className="grid grid-cols-3 max-[640px]:grid-cols-1 border border-line mb-7">
        <div className="p-[22px] px-6 border-r border-line max-[640px]:border-r-0 max-[640px]:border-b last:border-r-0 max-[640px]:last:border-b-0">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-[10px]">
            Total pooled
          </div>
          <div className="text-4xl font-medium tracking-[-0.03em] leading-none tabular-nums">
            <span className="text-fg-3 text-lg font-normal">£</span>
            {Math.round(total).toLocaleString()}
          </div>
        </div>
        <div className="p-[22px] px-6 border-r border-line max-[640px]:border-r-0 max-[640px]:border-b last:border-r-0 max-[640px]:last:border-b-0">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-[10px]">
            Even split
          </div>
          <div className="text-4xl font-medium tracking-[-0.03em] leading-none tabular-nums">
            <span className="text-fg-3 text-lg font-normal">£</span>
            {Math.round(perPerson).toLocaleString()}
          </div>
        </div>
        <div className="p-[22px] px-6">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-[10px]">
            You&apos;ve covered
          </div>
          <div className="text-4xl font-medium tracking-[-0.03em] leading-none tabular-nums">
            <span className="text-fg-3 text-lg font-normal">£</span>
            {Math.round(myTotal).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_160px_auto] max-[640px]:grid-cols-1 gap-2 mb-5">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What was it for..."
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3"
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
          placeholder="Amount (£)"
          className="bg-bg-2 border border-line px-[14px] py-[11px] text-sm rounded-md focus:border-line-2 outline-none transition-colors placeholder:text-fg-3"
        />
        <button
          onClick={handleAdd}
          className="bg-fg text-bg px-[22px] py-[11px] text-[13px] font-medium rounded-md hover:bg-accent transition-colors cursor-pointer active:scale-[0.98]"
        >
          Log
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="border border-line py-14 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3 mb-8">
          No expenses logged
        </div>
      ) : (
        <div className="border border-line mb-8">
          {expenses.map((e) => {
            const mine = e.paid_by === currentUserId;
            return (
              <div
                key={e.id}
                className="grid grid-cols-[70px_1fr_auto_36px] items-center py-[14px] px-6 border-b border-line last:border-b-0 gap-4"
              >
                <div className="font-mono text-[11px] text-fg-3 tracking-[0.05em] uppercase">
                  {formatDate(e.created_at)}
                </div>
                <div>
                  <div className="text-sm font-medium tracking-[-0.01em]">
                    {e.description}
                  </div>
                  <div className="font-mono text-[10px] text-fg-3 tracking-[0.08em] uppercase mt-[2px]">
                    By {nameById.get(e.paid_by) ?? "Unknown"}
                  </div>
                </div>
                <div className="text-[17px] font-medium tracking-[-0.02em] tabular-nums">
                  £{Math.round(Number(e.amount)).toLocaleString()}
                </div>
                {mine ? (
                  <button
                    onClick={() => handleDelete(e.id)}
                    aria-label="Delete expense"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-fg-4 hover:text-err hover:bg-bg-2 transition-colors cursor-pointer text-sm"
                  >
                    ✕
                  </button>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      )}

      {crew.length >= 2 && expenses.length > 0 && (
        <div className="border border-line p-6">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-4">
            Settlement · positive = owed back
          </div>
          {balances.map((b) => {
            const rounded = Math.round(Math.abs(b.net));
            const tone =
              b.net > 0 ? "text-ok" : b.net < 0 ? "text-err" : "text-fg-3";
            const label =
              b.net > 0
                ? `+£${rounded.toLocaleString()} back`
                : b.net < 0
                  ? `£${rounded.toLocaleString()} owed`
                  : `£0 even`;
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
            Maths runs on current crew size. Settle on Sun.
          </div>
        </div>
      )}
    </>
  );
}
