"use client";

import { useEffect, useState } from "react";
import { currencySymbol } from "@/lib/currency";

function daysUntil(iso: string) {
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}

type Props = {
  heroTitle: string;
  heroSubtitle: string | null;
  cityLabel: string;
  datesLabel: string;
  startDate: string | null;
  status: "planning" | "locked";
  crewCount: number;
  targetCrew: number | null;
  bookingsDone: number;
  bookingsTotal: number;
  kittyTotal: number;
  targetBudgetPp: number | null;
  currency: string | null;
};

export function Hero({
  heroTitle,
  heroSubtitle,
  cityLabel,
  datesLabel,
  startDate,
  status,
  crewCount,
  targetCrew,
  bookingsDone,
  bookingsTotal,
  kittyTotal,
  targetBudgetPp,
  currency,
}: Props) {
  const symbol = currencySymbol(currency);
  const [days, setDays] = useState(() =>
    startDate ? daysUntil(startDate) : null,
  );

  useEffect(() => {
    if (!startDate) return;
    const id = setInterval(() => setDays(daysUntil(startDate)), 60_000);
    return () => clearInterval(id);
  }, [startDate]);

  return (
    <div className="pt-[70px] pb-[60px] border-b border-line relative">
      <div className="flex flex-wrap gap-7 mb-10 font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
        <span>
          LOC / <b className="text-fg font-medium">{cityLabel}</b>
        </span>
        <span>
          DATES / <b className="text-fg font-medium">{datesLabel}</b>
        </span>
        <span>
          CREW /{" "}
          <b className="text-fg font-medium">
            {crewCount}
            {targetCrew ? ` / ${targetCrew}` : ""}
          </b>
        </span>
        <span>
          STATUS /{" "}
          <b className="text-fg font-medium">
            {status === "locked" ? "LOCKED" : "PLANNING"}
          </b>
        </span>
      </div>

      <h1
        className="font-bold leading-[0.88] mb-7"
        style={{
          fontSize: "clamp(64px, 13vw, 180px)",
          letterSpacing: "-0.055em",
        }}
      >
        {heroTitle}
        <span className="text-accent">.</span>
      </h1>

      {heroSubtitle && (
        <p className="max-w-[620px] text-[18px] leading-[1.5] text-fg-2">
          {heroSubtitle}
        </p>
      )}

      <div className="mt-14 grid grid-cols-4 max-[720px]:grid-cols-2 border-t border-line">
        <StatCell
          label="T-Minus"
          value={days !== null ? days.toString() : "—"}
          unit={days !== null ? "d" : undefined}
          sub={days !== null ? "Until wheels up" : "Set dates in settings"}
        />
        <StatCell
          label="Target budget"
          value={
            targetBudgetPp !== null
              ? `${symbol}${targetBudgetPp.toLocaleString("en-US")}`
              : "—"
          }
          unit={targetBudgetPp !== null ? "pp" : undefined}
          sub={targetBudgetPp !== null ? "Ex. flights" : "Not set"}
        />
        <StatCell
          label="Bookings"
          value={`${bookingsDone}/${bookingsTotal}`}
          sub="Locked in"
        />
        <StatCell
          label="Kitty"
          value={`${symbol}${Math.round(kittyTotal).toLocaleString("en-US")}`}
          sub="Pooled to date"
        />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
}) {
  return (
    <div className="py-6 pr-6 border-r border-line last:border-r-0 max-[720px]:[&:nth-child(2n)]:border-r-0 max-[720px]:[&:nth-child(-n+2)]:border-b max-[720px]:[&:nth-child(-n+2)]:border-line">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-[10px]">
        {label}
      </div>
      <div className="flex items-baseline">
        <span className="text-[48px] font-medium tracking-[-0.03em] leading-none tabular">
          {value}
        </span>
        {unit && (
          <span className="text-fg-3 text-[20px] font-normal ml-[2px]">
            {unit}
          </span>
        )}
      </div>
      <div className="text-xs text-fg-3 mt-[6px] font-mono tracking-[0.05em]">
        {sub}
      </div>
    </div>
  );
}
