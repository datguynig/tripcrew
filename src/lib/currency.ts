export const CURRENCIES = [
  { code: "GBP", symbol: "£", label: "Pound" },
  { code: "USD", symbol: "$", label: "US dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "SEK", symbol: "kr", label: "Swedish krona" },
  { code: "NOK", symbol: "kr", label: "Norwegian krone" },
  { code: "DKK", symbol: "kr", label: "Danish krone" },
  { code: "CHF", symbol: "Fr", label: "Swiss franc" },
  { code: "JPY", symbol: "¥", label: "Japanese yen" },
  { code: "AUD", symbol: "A$", label: "Australian dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian dollar" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "£";
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatMoney(
  amount: number | null | undefined,
  code: string | null | undefined,
  options: { omitDecimals?: boolean } = {},
): string {
  if (amount === null || amount === undefined) return "—";
  const symbol = currencySymbol(code);
  const formatted = options.omitDecimals
    ? Math.round(amount).toLocaleString("en-US")
    : amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
  return `${symbol}${formatted}`;
}
