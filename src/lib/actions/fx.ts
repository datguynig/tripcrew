"use server";

import { getFxSuggestion } from "@/lib/fx/frankfurter";

export async function getFxSuggestionAction(
  fromCurrency: string,
  fromAmount: number,
  toCurrency: string,
): Promise<{ suggested_amount: number; rate: number; rate_date: string } | null> {
  return getFxSuggestion(fromCurrency, fromAmount, toCurrency);
}
