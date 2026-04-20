-- ============================================================
-- Trip currency
--
-- Previously every monetary display hard-coded "£". Adding a
-- currency code on the trip lets admin choose and every display
-- reads from one source.
--
-- Default GBP (existing trips get this). Constraint covers the
-- currencies the picker offers today — extend as needed.
-- ============================================================

alter table trips
  add column if not exists currency text not null default 'GBP';

alter table trips drop constraint if exists trips_currency_check;
alter table trips add constraint trips_currency_check
  check (currency in (
    'GBP', 'USD', 'EUR', 'SEK', 'NOK', 'DKK', 'CHF', 'JPY', 'AUD', 'CAD'
  ));
