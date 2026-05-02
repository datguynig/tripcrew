"use client";

import { useMemo } from "react";
import { ObligationRow } from "./ObligationRow";
import { currencySymbol } from "@/lib/currency";
import type { PaymentObligation, Payment } from "@/lib/types";

type Props = {
  obligations: PaymentObligation[];
  paymentsByObligationId: Map<string, Payment[]>;
  currentUserId: string;
  isAdmin: boolean;
  currency: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "NO DATE";
  const d = new Date(`${iso}T00:00:00Z`);
  return d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

// Build today's ISO string from local-time fields. Using UTC here would
// flip the bucket when the user is east of UTC and the local date hasn't
// turned over yet. The schedule's "due today" should match what the user
// sees on their wall clock, not the server's UTC clock.
function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function ScheduleView({
  obligations,
  paymentsByObligationId,
  currentUserId,
  isAdmin,
  currency,
}: Props) {
  const groups = useMemo(() => {
    const todayIso = localTodayIso();
    const future = new Map<string, PaymentObligation[]>();
    const pastDue: PaymentObligation[] = [];
    const noDate: PaymentObligation[] = [];
    for (const o of obligations.filter((o) => o.status === "open")) {
      if (!o.due_date) {
        noDate.push(o);
      } else if (o.due_date < todayIso) {
        pastDue.push(o);
      } else {
        const arr = future.get(o.due_date) ?? [];
        arr.push(o);
        future.set(o.due_date, arr);
      }
    }
    return {
      future: Array.from(future.entries()).sort(([a], [b]) => a.localeCompare(b)),
      pastDue,
      noDate,
    };
  }, [obligations]);

  if (obligations.length === 0) {
    return (
      <div className="border border-line py-14 text-center font-mono text-[11px] text-fg-3 tracking-[0.08em] uppercase">
        NO PAYBACK SCHEDULE YET
      </div>
    );
  }

  const symbol = currencySymbol(currency);

  const renderGroup = (
    label: string,
    rows: PaymentObligation[],
    tone: "warn" | "default" = "default",
  ) => {
    if (rows.length === 0) return null;
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    return (
      <div className="border border-line bg-bg-2 mb-4">
        <div className="px-5 py-3 border-b border-line flex items-baseline justify-between">
          <div className={`label-sm-wide ${tone === "warn" ? "text-warn" : ""}`}>{label}</div>
          <div className="font-mono text-[11px] tabular-nums text-fg-3">
            {symbol}{Math.round(total).toLocaleString()} · {rows.length} obligations
          </div>
        </div>
        {rows.map((o) => (
          <ObligationRow
            key={o.id}
            obligation={o}
            payments={paymentsByObligationId.get(o.id) ?? []}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      {renderGroup("PAST DUE", groups.pastDue, "warn")}
      {groups.future.map(([date, rows]) => renderGroup(`DUE ${formatDate(date)}`, rows))}
      {renderGroup("NO DUE DATE", groups.noDate)}
    </div>
  );
}
