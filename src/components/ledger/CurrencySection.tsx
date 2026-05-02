// src/components/ledger/CurrencySection.tsx
"use client";

import { useEffect, useTransition } from "react";
import { INPUT_SM } from "@/lib/styles";
import { isSupportedCurrency } from "@/lib/fx/frankfurter";

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
  tripCurrency: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  value: FxState;
  onChange: (next: FxState) => void;
  getFxSuggestion: (
    fromCurrency: string,
    fromAmount: number,
    toCurrency: string,
  ) => Promise<{ suggested_amount: number; rate: number; rate_date: string } | null>;
};

const COMMON_CURRENCIES = [
  "EUR", "USD", "GBP", "JPY", "CAD", "AUD", "CHF", "SGD", "HKD",
  "SEK", "NOK", "DKK", "INR", "MXN", "BRL", "ZAR",
];

function formatRateDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

export function CurrencySection({
  tripCurrency,
  enabled,
  onToggle,
  value,
  onChange,
  getFxSuggestion,
}: Props) {
  const [pending, startTransition] = useTransition();
  const supported = isSupportedCurrency(value.original_currency);

  useEffect(() => {
    if (!enabled || !supported || !value.original_amount || value.fx_user_overridden) {
      return;
    }
    if (value.original_currency === tripCurrency) return;
    startTransition(async () => {
      const suggestion = await getFxSuggestion(
        value.original_currency,
        value.original_amount as number,
        tripCurrency,
      );
      if (!suggestion) return;
      onChange({
        ...value,
        trip_amount: suggestion.suggested_amount,
        fx_rate: suggestion.rate,
        fx_rate_date: suggestion.rate_date,
        fx_rate_source: "frankfurter",
      });
    });
  }, [enabled, supported, value.original_currency, value.original_amount, value.fx_user_overridden, tripCurrency]);

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        className="label-sm text-fg-3 hover:text-accent transition-colors"
      >
        + Paid in another currency
      </button>
    );
  }

  return (
    <div className="border border-line bg-bg-2 p-4 grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-sm-wide text-fg-3">PAID IN ANOTHER CURRENCY</div>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className="label-sm text-fg-3 hover:text-fg transition-colors"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-2 max-[480px]:grid-cols-1">
        <select
          aria-label="Currency"
          value={value.original_currency}
          onChange={(e) =>
            onChange({
              ...value,
              original_currency: e.target.value,
              fx_rate_source: isSupportedCurrency(e.target.value) ? "frankfurter" : "manual",
            })
          }
          className={INPUT_SM}
        >
          {COMMON_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder={`Amount in ${value.original_currency}`}
          value={value.original_amount ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              original_amount: e.target.value === "" ? null : Number(e.target.value),
              fx_user_overridden: false,
            })
          }
          className={INPUT_SM}
        />
      </div>

      {!supported && (
        <p className="text-[12px] text-fg-3 leading-[1.5]">
          We do not have a live rate for {value.original_currency}. Enter both amounts manually.
        </p>
      )}
      {supported && value.fx_rate && value.fx_rate_date && !value.fx_user_overridden && (
        <p className="text-[12px] text-fg-3 leading-[1.5]">
          Suggested rate (Frankfurter, ECB · {formatRateDate(value.fx_rate_date)}): {value.fx_rate.toFixed(4)}
          {pending && " · refreshing..."}
        </p>
      )}
      {supported && value.fx_rate_date && (() => {
        const today = new Date().toISOString().slice(0, 10);
        return value.fx_rate_date < today ? (
          <p className="text-[11px] text-fg-3 leading-[1.5]">
            Frankfurter uses the latest available ECB rate. This suggestion is from {formatRateDate(value.fx_rate_date)}, not today.
          </p>
        ) : null;
      })()}

      <label className="grid gap-1.5">
        <span className="label-sm-wide text-fg-3">TRIP CURRENCY ({tripCurrency})</span>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder={`Trip currency amount (${tripCurrency})`}
          value={value.trip_amount ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              trip_amount: e.target.value === "" ? null : Number(e.target.value),
              fx_user_overridden: true,
            })
          }
          className={INPUT_SM}
        />
      </label>
    </div>
  );
}
