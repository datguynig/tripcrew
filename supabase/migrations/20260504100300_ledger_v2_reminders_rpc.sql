-- supabase/migrations/20260504100300_ledger_v2_reminders_rpc.sql
-- Ledger v2 Phase 2 · payment_due_reminders_sent + transactional RPC

create table if not exists payment_due_reminders_sent (
  trip_id uuid not null references trips(id) on delete cascade,
  debtor_id uuid not null references profiles(id),
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  primary key (trip_id, debtor_id, reminder_date)
);

-- Atomic insert of the marker + the notification row in one
-- transaction. Caller is the cron route running with the service
-- role. Returns 'sent' on success, 'duplicate' if the marker already
-- exists (idempotent). Any other error rolls back both rows so the
-- next nightly run will retry.
create or replace function record_payment_reminder_summary(
  p_trip_id uuid,
  p_debtor_id uuid,
  p_reminder_date date,
  p_payload jsonb
) returns text
language plpgsql
security definer
as $$
begin
  insert into payment_due_reminders_sent (trip_id, debtor_id, reminder_date)
  values (p_trip_id, p_debtor_id, p_reminder_date);

  insert into notifications (user_id, trip_id, kind, actor_id, entity_id, payload)
  values (p_debtor_id, p_trip_id, 'payment_due_reminder', null, null, p_payload);

  return 'sent';
exception when unique_violation then
  -- Marker already exists for (trip_id, debtor_id, reminder_date).
  return 'duplicate';
end;
$$;

revoke all on function record_payment_reminder_summary(uuid, uuid, date, jsonb) from public;
