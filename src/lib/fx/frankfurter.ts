const FRANKFURTER_BASE = "https://api.frankfurter.app";

// Major fiat currencies Frankfurter supports (ECB-listed). When a
// currency falls outside this list, the FX entry UX falls back to
// fully-manual: user enters both original and trip-currency amounts.
const SUPPORTED = new Set([
  "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP",
  "HKD", "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR",
  "NOK", "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD",
  "ZAR",
]);

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED.has(code.toUpperCase());
}

type FrankfurterRaw = {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

export function parseFrankfurterResponse(
  raw: unknown,
  fromCurrency: string,
  toCurrency: string,
): { rate: number; rate_date: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as FrankfurterRaw;
  const amount = typeof r.amount === "number" ? r.amount : null;
  if (amount === null || amount <= 0) return null;
  if (!r.rates || typeof r.rates !== "object") return null;
  const target = r.rates[toCurrency];
  if (typeof target !== "number" || target <= 0) return null;
  if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
  return { rate: target / amount, rate_date: r.date };
}

export type FxSuggestion = {
  suggested_amount: number;             // in trip currency
  rate: number;
  rate_date: string;                    // ISO yyyy-mm-dd; may be a previous weekday on weekends
  source: "frankfurter";
};

// Server-callable. Returns null when currency is unsupported, the
// network request fails, or the response is malformed. UI falls back
// to manual entry in those cases.
export async function getFxSuggestion(
  fromCurrency: string,
  fromAmount: number,
  toCurrency: string,
): Promise<FxSuggestion | null> {
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
    return null;
  }
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return null;
  }
  const url = `${FRANKFURTER_BASE}/latest?amount=1&from=${encodeURIComponent(
    fromCurrency.toUpperCase(),
  )}&to=${encodeURIComponent(toCurrency.toUpperCase())}`;
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 3600 } });
  } catch (err) {
    console.error("[fx.frankfurter] fetch failed", err);
    return null;
  }
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as unknown;
  const parsed = parseFrankfurterResponse(json, fromCurrency, toCurrency);
  if (!parsed) return null;
  return {
    suggested_amount: Math.round(fromAmount * parsed.rate * 100) / 100,
    rate: parsed.rate,
    rate_date: parsed.rate_date,
    source: "frankfurter",
  };
}
