import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DueRow = {
  id: string;
  trip_id: string;
  debtor_id: string;
  creditor_id: string;
  creditor_name_snapshot: string;
  expense_id: string | null;
  amount: string;
  currency: string;
  due_date: string;
  expense_description: string | null;
};

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/payment-reminders] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const reminderDate = tomorrowIso();

  const { data, error } = await supabase
    .from("payment_obligations")
    .select(
      "id, trip_id, debtor_id, creditor_id, creditor_name_snapshot, expense_id, amount, currency, due_date, expenses:expense_id(description)",
    )
    .eq("status", "open")
    .eq("due_date", reminderDate);

  if (error) {
    console.error("[cron/payment-reminders] query failed", error);
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }

  const rows = (data ?? []).map((r): DueRow => {
    const exp = Array.isArray(r.expenses) ? r.expenses[0] : r.expenses;
    return {
      id: r.id,
      trip_id: r.trip_id,
      debtor_id: r.debtor_id,
      creditor_id: r.creditor_id,
      creditor_name_snapshot: r.creditor_name_snapshot,
      expense_id: r.expense_id,
      amount: r.amount,
      currency: r.currency,
      due_date: r.due_date,
      expense_description: exp?.description ?? null,
    };
  });

  const groups = new Map<string, DueRow[]>();
  for (const r of rows) {
    const key = `${r.trip_id}::${r.debtor_id}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  let sent = 0;
  let duplicates = 0;
  let failed = 0;

  for (const [key, group] of groups) {
    const [trip_id, debtor_id] = key.split("::");
    const total = group.reduce((s, r) => s + Number(r.amount), 0);
    const payload = {
      reminder_date: reminderDate,
      currency: group[0].currency,
      total_amount: total.toFixed(2),
      obligations: group.map((r) => ({
        obligation_id: r.id,
        creditor_id: r.creditor_id,
        creditor_name: r.creditor_name_snapshot,
        expense_description: r.expense_description ?? undefined,
        amount: r.amount,
      })),
    };

    const { data: result, error: rpcErr } = await supabase.rpc("record_payment_reminder_summary", {
      p_trip_id: trip_id,
      p_debtor_id: debtor_id,
      p_reminder_date: reminderDate,
      p_payload: payload,
    });

    if (rpcErr) {
      console.error("[cron/payment-reminders] rpc failed", { trip_id, debtor_id }, rpcErr);
      failed += 1;
      continue;
    }
    if (result === "duplicate") duplicates += 1;
    else sent += 1;
  }

  return NextResponse.json({ ok: true, processed: groups.size, sent, duplicates, failed });
}
