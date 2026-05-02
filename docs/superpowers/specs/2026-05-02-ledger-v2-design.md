# Ledger v2 — Spec A Design

**Date:** 2026-05-02
**Status:** Approved by founder + Codex review pass
**Phasing:** Three phases shipping under one design

## Context

Yenkoh's current `expenses` model is a flat list: `(id, trip_id, description, amount, paid_by, created_at)`. The settlement panel computes running net balances via implicit even-split across `target_crew_size`. There is no:

- Per-expense participant set (subset or weighted shares)
- Multi-currency support
- Schedule for paying back over time
- Tracked payment between members
- Paid / verified state
- Reminders for due payments

Real-life trips need all of these. The dominant pain is **pre-trip installment payback**: someone fronts a flight or villa booking, the rest of the crew owes their share back over several months before the trip, and the cash flow needs tracking and reminders. Post-trip cleanup is the secondary need: small leftover balances settled quickly before they drift.

This spec defines a relational money model that handles both flows, multi-currency expenses, and a state machine for payments rigorous enough for friend-group trust without being heavy enough to feel like accounting software.

## Goals

- Track who owes whom, with optional due dates and installments, in a way that survives expense edits without losing payment history
- Support per-expense participant selection with weighted, percentage, or exact shares (default = even split across crew, no UX change required for the 80% case)
- Support multi-currency expenses with FX provenance (rate, source, date, override flag) so card-statement reality can win over API estimates
- Provide first-class payment states (`pending`, `verified`, `rejected`, `voided`) and a clear authority model
- Send timely in-app reminders one day before due dates without spamming on retries

## Non-goals (v1)

- File attachments on payments (notes only; attachment-friendly schema can be added later)
- Multi-payer expenses (one payer per expense)
- Refunds and deposits as first-class concepts
- Per-trip timezone handling (defaults to UTC; "1 day before due_date" interpreted as 24h before midnight UTC)
- Pre-invite obligations (only current trip members can be debtors; document the workaround)
- Splitwise-style minimal-transfer graph reduction (deferred to Phase 3 polish)

## Architecture overview

The ledger keeps a hybrid model: `expenses` records purchases, but money flow between members lives in two new normalized tables — `payment_obligations` (what is owed) and `payments` (what has actually moved). A third small table, `payment_due_reminders_sent`, makes the cron idempotent. Subset and weighted shares live in a fourth new table, `expense_participants`, which replaces the originally-proposed `participants` JSONB column. JSONB stays only for `expenses.schedule`, where it describes the shape of the payback timeline rather than financial state.

Editing an expense never silently mutates obligations. Instead, affected open obligations transition to `superseded`, and new obligations are generated from the updated participant + schedule data. Payments stay attached to their original obligation rows. A "Reissued" admin panel lists superseded obligations whose payments need to be paired with the new ones.

Soft-delete is mandatory for expenses, participants, obligations, and payments. Hard deletes do not exist for money rows.

## Data model

### `expenses` — extended

```sql
alter table expenses
  add column original_currency text null,           -- ISO 4217 code, e.g. "EUR"
  add column original_amount numeric(12, 2) null,   -- amount as paid in that currency
  add column fx_rate numeric(12, 6) null,           -- amount / original_amount, stored at log time
  add column fx_rate_source text null,              -- "frankfurter" | "manual" | null
  add column fx_rate_date date null,                -- the rate's reference date (Frankfurter only updates weekdays; weekends use last weekday)
  add column fx_suggested_amount numeric(12, 2) null, -- what the API offered, before any user override
  add column fx_user_overridden boolean default false, -- true if user changed the suggested trip-currency amount
  add column schedule jsonb null,                   -- see schedule shape below
  add column version int not null default 1,        -- bumped each edit; obligations carry this for audit
  add column deleted_at timestamptz null;
```

The legacy `expenses.amount` remains the trip-currency total. When the expense was paid in another currency, `original_amount` holds the foreign value and `amount` holds the trip-currency equivalent (either the API suggestion or the user's override).

`schedule` JSONB shape:

```ts
type Schedule =
  | { type: "none" }                                                 // no schedule, settle ad-hoc
  | { type: "single"; due_date: string }                             // ISO date
  | { type: "installments"; installments: { due_date: string; fraction: number }[] };
```

`fraction` values per installment must sum to 1.0 (with the last installment absorbing rounding remainder when split into equal shares).

### `expense_participants` — new

```sql
create table expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id),
  user_id text not null references profiles(id),
  share_amount numeric(12, 2) not null,             -- in trip currency
  share_basis text not null,                        -- "equal" | "percentage" | "exact"
  share_input numeric(12, 4) null,                  -- raw user input (e.g. 50 for 50%)
  display_name_snapshot text not null,              -- captured at log time for historical preservation
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index expense_participants_expense_id_idx on expense_participants (expense_id) where deleted_at is null;
create index expense_participants_user_id_idx on expense_participants (user_id) where deleted_at is null;
```

The `display_name_snapshot` preserves who was on the bill even if the profile is later renamed or removed. `share_basis` documents how the user authored the split so the form can reproduce the editing UX. `share_input` is the raw input (50, 25, 25 for percentages); `share_amount` is the resolved cash value.

When an expense is logged with the default even-split, the system creates one row per current trip member with `share_basis = "equal"` and `share_amount = expenses.amount / N`.

### `payment_obligations` — new

```sql
create table payment_obligations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  expense_id uuid null references expenses(id),     -- null = ad-hoc post-trip settlement (Phase 3)
  expense_version int null,                         -- version of expense when this obligation was created
  debtor_id text not null references profiles(id),
  creditor_id text not null references profiles(id),
  debtor_name_snapshot text not null,
  creditor_name_snapshot text not null,
  due_date date null,
  amount numeric(12, 2) not null,
  currency text not null,                           -- trip currency at time of generation
  installment_index int null,                       -- which slot of the schedule
  status text not null default 'open',              -- 'open' | 'superseded' | 'voided'
  superseded_by uuid null references payment_obligations(id),
  voided_by text null references profiles(id),
  voided_at timestamptz null,
  void_reason text null,
  created_at timestamptz not null default now(),
  created_by text not null references profiles(id),
  check (debtor_id <> creditor_id)
);

create index payment_obligations_trip_status_due_idx on payment_obligations (trip_id, status, due_date);
create index payment_obligations_debtor_status_idx on payment_obligations (debtor_id, status);
create index payment_obligations_expense_idx on payment_obligations (expense_id) where status = 'open';
```

One row per (debtor, creditor, installment slot). For an expense with 4 non-payer participants and 3 installments, the system creates 12 rows up front. Each is independently progressable.

### `payments` — new

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references payment_obligations(id),
  amount numeric(12, 2) not null,                   -- positive; partial payments allowed
  recorded_by text not null references profiles(id),
  recorded_at timestamptz not null default now(),
  status text not null default 'pending',           -- 'pending' | 'verified' | 'rejected' | 'voided'
  verified_by text null references profiles(id),
  verified_at timestamptz null,
  rejected_by text null references profiles(id),
  rejected_at timestamptz null,
  rejection_note text null,
  voided_by text null references profiles(id),
  voided_at timestamptz null,
  void_reason text null,
  note text null,                                   -- payment method, bank ref, freeform context
  check (amount > 0)
);

create index payments_obligation_status_idx on payments (obligation_id, status);
```

Rejected payments are non-destructive: the row stays with `status = 'rejected'`, full audit fields populated. They never count toward `paid_amount`.

### `payment_due_reminders_sent` — new (idempotency)

```sql
create table payment_due_reminders_sent (
  obligation_id uuid not null references payment_obligations(id),
  reminder_date date not null,                      -- the date the reminder was for
  sent_at timestamptz not null default now(),
  primary key (obligation_id, reminder_date)
);
```

The cron filters on `obligation.due_date = current_date + 1` and inserts into this table only after the notification fans out. Composite primary key blocks duplicates on retries.

## State machines

### Obligation status

```
open ──────────► superseded   (expense edited; new obligations generated)
  │
  └────────────► voided       (admin voids; never auto)
```

`is_settled` is a derived view: an open obligation is settled when `SUM(payments.amount WHERE status = 'verified') >= obligation.amount`. A `provisionally_settled` flag covers the in-between state where pending payments would settle the obligation but haven't been verified yet.

Superseded obligations are read-only history. Their payments stay attached and remain queryable for audit. The Reissued panel lists superseded obligations with non-zero verified payments where the new obligations don't auto-pair.

### Payment status

```
            recorded_at, status='pending'
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   verified         rejected          voided
   by admin      by creditor/admin    by recorder (5-min) or admin
```

- `pending` is the default on creation
- `verified` requires admin (sets `verified_by`, `verified_at`)
- `rejected` requires creditor or admin (sets `rejected_by`, `rejected_at`, optional `rejection_note`)
- `voided` is reserved for "this payment shouldn't have been recorded at all" — recorder can void within 5 minutes of `recorded_at`, otherwise admin only

Only `verified` payments count toward `obligation.is_settled`. `pending` and `rejected` and `voided` do not.

## Authority model

| Action | Allowed actors |
|---|---|
| Log an expense | Any trip member |
| Edit an expense (description, amount, currency, participants, schedule) | Original payer or admin |
| Soft-delete an expense | Original payer or admin |
| Record a payment | Debtor or creditor on the obligation |
| Verify a payment | Admin only |
| Reject a payment | Creditor or admin |
| Void a payment | Recorder within 5 minutes of `recorded_at`, otherwise admin only |
| Void an obligation | Admin only |

## Phase 1 — Foundation: relational splits + multi-currency

### What ships

1. Migrations: extend `expenses`, create `expense_participants`, soft-delete columns, indexes
2. Backfill migration: for each existing `expenses` row, create `expense_participants` rows for the current `target_crew_size` count of trip members with `share_basis = "equal"` and `share_amount = amount / N`
3. Logging form: opt-in expanding sections for "Paid in another currency" and "Customise split"
4. Frankfurter integration in `src/lib/fx/` with a thin server action `getFxSuggestion(currency, amount, trip_currency, date)` that returns `{ suggested_amount, rate, rate_date, source }`. Manual-only fallback for unsupported currencies
5. Ledger expense list: render participants summary ("Split 4 ways" or "4 of 5 · weighted") and FX badge ("€85 at 0.847")
6. Settlement section: extend the existing balance computation to read from `expense_participants.share_amount` instead of even-split-derived from `target_crew_size`
7. Soft-delete UX: deleted expenses hidden from list but reachable via admin "Show deleted" toggle. Restoring is a one-click action

### What does NOT ship in Phase 1

- Schedules
- `payment_obligations`
- `payments`
- Verification flow
- Reminders / cron
- Schedule view sub-page
- Settle-up panel

The settlement section keeps showing running net balances per member. No new "paid" toggles yet. This phase is pure model refactor + multi-currency.

### Why ship Phase 1 alone

The relational participants table is a foundation for everything else. Shipping it as a one-PR refactor with backward compatibility (legacy expenses backfilled) lets us land the model change with low risk before layering schedules and payments on top. If a regression surfaces, it's bounded to the participants/FX surface.

### Logging UX

```
Description                                                  [_______________]
Amount                                                       [£_______]
Paid by                                                      [Me ▼]

[ ] Paid in another currency
    Currency [EUR ▼]    Original amount [€_____]
    Suggested rate today (Frankfurter, ECB · 2026-05-02): 0.847
    Trip currency amount [£_____]   ← user can override (sets fx_user_overridden)
    Note: Frankfurter does not update on weekends. The suggested rate
    on Saturday or Sunday is the previous Friday's ECB close.

[ ] Customise split (otherwise even across crew)
    ☑ Nigel       50%  £___
    ☑ Sarah       25%  £___
    ☑ Tom         25%  £___
    ☐ Alex        excluded
    Mode toggle: [ Equal · Percentage · Exact amount ]
```

### Edge cases

- **Unsupported currency.** Frankfurter does not list it. UI shows "We don't have a live rate for [XYZ]. Enter both amounts manually." Both fields editable; `fx_rate_source = "manual"` on save.
- **Weekend FX log.** Banner under the suggested rate explains the rate is from the previous Friday's ECB close. User can still override.
- **Backfill rounding.** When backfilling participants for legacy even-split expenses, the last participant's `share_amount` absorbs rounding remainder so the sum matches `expenses.amount` exactly.
- **Member leaves trip mid-Phase 1.** Their `expense_participants` rows stay intact via `display_name_snapshot`. The settlement section shows them by their snapshot name with a small "Left trip" pill.
- **Subset / weighted re-default check.** If admin opens an existing legacy expense in the edit form, the form opens in even-split mode showing the current rows. They can re-customise from there.

## Phase 2 — Pre-trip installments

### What ships

1. Migrations: create `payment_obligations`, `payments`, `payment_due_reminders_sent`. Add `expenses.schedule` column and `expenses.version`
2. Logging form: third opt-in section for "Schedule payback" (none / single date / N installments / custom dates)
3. Obligation generator: server action `generateObligations(expenseId)` that creates obligations from `(participants × schedule)` with the current `expense_version` stamped on each row
4. Versioned regenerate-on-edit: when an expense's participants or schedule change, transition affected open obligations to `superseded`, run `generateObligations` again with the new version
5. Reissued panel: admin-only UI lists superseded obligations whose `verified` payments don't auto-pair to a new obligation matching `(debtor, creditor, due_date)`. Admin can void the orphan or re-pair manually
6. Schedule view sub-page on `/trips/[slug]/ledger`: chronological list grouped by `due_date` with `[✓ Mark paid]` and `[Verify]` actions
7. Payment recording: server action `recordPayment(obligationId, amount, note?)` creates a `payments` row with `status = 'pending'`. Partial payments supported
8. Verification: server action `verifyPayment(paymentId)` checked admin-only; sets `verified_by`, `verified_at`
9. Rejection: server action `rejectPayment(paymentId, note?)` checked creditor-or-admin; sets `rejected_by`, `rejected_at`, optional `rejection_note`. Row stays in audit trail
10. Void: server action `voidPayment(paymentId, reason?)` checked recorder-within-5-min OR admin
11. Cron route at `/api/cron/payment-reminders`: nightly, honors `CRON_SECRET`. Selects open obligations where `due_date = (current_date + 1)` and the `(obligation_id, reminder_date)` row is absent from `payment_due_reminders_sent`. Inserts the row before fanning out the notification (insert-first prevents duplicate fanout on retry)
12. Notifications: 4 new kinds layered onto existing system
    - `payment_due_reminder` → debtor, 1 day before due_date
    - `payment_recorded` → creditor, on payment record
    - `payment_verified` → debtor, on admin verify
    - `payment_rejected` → debtor, on rejection (with note)

### Logging UX additions

```
[ ] Schedule payback
    ○ No schedule (default)
    ○ Single due date              [📅 ____]
    ○ Split into [3] installments, monthly until [📅 trip date]
    ○ Custom dates                 add row [+]
        [📅 1 Mar]  [33%]
        [📅 1 Apr]  [33%]
        [📅 1 May]  [34%]
```

### Schedule view

```
DUE 1 MAR 2026 · £450 across 3 obligations
  Sarah  →  Nigel    £150        [Mark paid] [Mark partial]
  Tom    →  Nigel    £75         £50 of £75 paid · 1 pending verification  [Verify]
  Alex   →  Nigel    £225        Settled · verified ✓

DUE 1 APR 2026
  ...

PAST DUE
  ...
```

Tap a row to expand — shows payment history (all rows, including rejected with reason), a notes field, and tier-aware action buttons.

### Edge cases

- **Edit changes installment count from 3 to 4.** Existing 3 obligations transition to `superseded`. 4 new obligations generated. Verified payments on the old obligations stay attached. If the new schedule's `(debtor, creditor, due_date)` matches the old, system auto-pairs (logs each pairing for audit). Unmatched verified payments surface in the Reissued panel for admin
- **Edit reduces participant set.** A removed participant's open obligations transition to `superseded`. Any verified payments on those superseded obligations represent a credit — surfaced in the Reissued panel for admin to void or convert into an ad-hoc obligation in the other direction (only relevant after Phase 3 ships, so v1 just leaves the credit in audit history)
- **Overpayment.** A debtor records £200 toward a £150 obligation. The system stores the £200, computes `paid_amount > amount`, and flags the obligation as overpaid in the UI. Admin resolves manually (Phase 3 introduces the proper Settle-up flow that accepts these as ad-hoc credits)
- **Partial payment + rejection.** Debtor records £50 toward £150. Creditor rejects the £50 (claim it didn't arrive). Row stays as `status=rejected`, paid_amount drops to £0. Debtor records again later
- **Pending invitee as debtor.** v1 only creates obligations for current trip members. If admin tries to log an expense with a not-yet-joined participant, the form blocks with "Add the crew member first, then log this expense." The trip-invite-token-as-placeholder approach is in the backlog
- **Cron retry.** Cron handler always inserts into `payment_due_reminders_sent` BEFORE fanning out. If insert fails on the unique constraint, the reminder was already sent today — skip
- **Trip timezone.** v1 interprets "1 day before due_date" as 24h before midnight UTC. A trip in Singapore with a 2026-06-01 due_date gets reminded at 2026-05-31 00:00 UTC, which is 2026-05-31 08:00 SGT. Document. Per-trip timezone is a backlog item
- **Soft-deleted expense.** All linked obligations transition to `voided` with `void_reason = "expense soft-deleted"`. Linked payments stay (audit trail). Restoring the expense regenerates fresh obligations (does not reopen the voided ones)

## Phase 3 — Post-trip settle-up

### What ships

1. Settle-up sub-view on `/trips/[slug]/ledger`: pair-wise net view computed from
   `(sum of obligations where creditor=A, debtor=B) − (sum of verified payments on those obligations)`
   per ordered pair, then collapsed across both directions
2. One-click ad-hoc obligation creation: tapping "Settle £42 from Tom to Nigel" creates a new `payment_obligation` with `expense_id = null`, `due_date = null`, `amount = 42`. The same Mark-paid + Verify flow handles it from there
3. `expense_settled` notification: sent to both parties when their pair's net reaches zero (sum of all obligations + payments between them is zero)
4. (Polish, deferred until Phase 3 ships and gets used) minimal-transfer-graph reduction: Splitwise-style algorithm that takes net balances and computes the smallest set of transfers needed to clear them. Surface as a "Suggest minimum transfers" button on the Settle-up panel

### Edge cases

- **Net balance from credits and obligations both directions.** If A owes B £30 from one expense and B owes A £20 from another, pair-wise net is £10 from A to B. A single Settle-up obligation handles it
- **Pair net reaches zero from a partial verified payment.** `expense_settled` fires only on the verification edge that brings the net to exactly zero — not on every mid-flow payment

## Notifications

All in-app, layered onto the existing `notifications` table. Adds 5 new `kind` values:

- `expense_added` (existing) — payload extended with FX info when present
- `payment_due_reminder` — `{ debtor_id (recipient), creditor_name, expense_description, amount, currency, due_date, obligation_id }`
- `payment_recorded` — `{ creditor_id (recipient), debtor_name, amount, currency, expense_description, obligation_id, payment_id }`
- `payment_verified` — `{ debtor_id (recipient), amount, currency, expense_description, payment_id }`
- `payment_rejected` — `{ debtor_id (recipient), amount, currency, rejection_note?, payment_id }`
- `expense_settled` — `{ recipient (both A and B), other_member_name, total_settled, currency }`

Coalescing: `payment_due_reminder` is per-(recipient, due_date) — if a debtor has 5 obligations due tomorrow, they get one summary notification, not 5.

## RLS posture

- `expense_participants`, `payment_obligations`, `payments`, `payment_due_reminders_sent`: trip members can read; only payer + admin can write to participants; only debtor/creditor/admin can write to obligations and payments per the authority table
- All writes route through server actions with explicit auth checks (the SSR-RLS combo is a defence-in-depth pair)

## Out of scope (backlog, in priority order)

- Multi-payer expenses (one expense paid by multiple people)
- Refunds and deposits as first-class concepts (not "paid amount can go negative")
- File attachments on payments (receipts, bank-transfer screenshots)
- Pre-invite obligations via trip_invite tokens
- Per-trip timezone for cron reminders
- Splitwise-style minimal-transfer graph reduction (Phase 3 polish)
- Recurring expenses (a Spotify-style "every month until trip" auto-creator)
- Bulk payment recording (paying off multiple obligations in one click)

## Open questions resolved

| Question | Resolution |
|---|---|
| Who can mark paid? | Debtor or creditor records a payment (status = pending) |
| Who can verify? | Admin only |
| Who can reject? | Creditor or admin (non-destructive — row stays with status = rejected) |
| Who can void/edit/delete a payment? | Recorder within 5 minutes of `recorded_at`, otherwise admin only |
| Partial payments? | Yes; obligation settled when SUM(verified payments) >= amount |
| FX entry UX? | User enters original amount and trip-currency amount both. Frankfurter API suggests trip amount; user can override (`fx_user_overridden = true`) |
| Edits allowed on expenses? | Yes; obligations are versioned. Open obligations transition to superseded on edit; verified payments stay attached as audit |
| Evidence on payments? | Notes field only in v1. Attachments deferred |
| Phase 1 size | Three phases, not two: foundation (relational splits + FX) → installments → settle-up |

## Implementation phasing summary

| Phase | Scope | Risk | PRs (estimated) |
|---|---|---|---|
| 1 — Foundation | Relational participants table, multi-currency, soft-delete | Low (data refactor with backfill) | 1 |
| 2 — Pre-trip installments | Schedules, obligations, payments, verification, cron, 4 notifications, schedule view | Medium-high (the headline feature, real money flow) | 2-3 |
| 3 — Post-trip settle | Settle-up panel, ad-hoc obligations, expense_settled notification | Low | 1-2 |
