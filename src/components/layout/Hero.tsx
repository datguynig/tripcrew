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
      <div className="flex flex-wrap gap-7 mb-10 label text-fg-3">
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
        <span className="inline-flex items-center gap-[10px]">
          STATUS /
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`w-[6px] h-[6px] rounded-full ${
                status === "locked" ? "bg-ok" : "bg-warn"
              }`}
              aria-hidden="true"
            />
            <b className="text-fg font-medium">
              {status === "locked" ? "LOCKED" : "PLANNING"}
            </b>
          </span>
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
          sub={targetBudgetPp !== null ? "Inc. flights" : "Not set"}
        />
        <StatCell
          label="Bookings"
          value={bookingsTotal > 0 ? `${bookingsDone}/${bookingsTotal}` : "—"}
          sub={bookingsTotal > 0 ? "Locked in" : "Nothing to book yet"}
          progress={
            bookingsTotal > 0 ? bookingsDone / bookingsTotal : null
          }
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
  progress = null,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  progress?: number | null;
}) {
  return (
    <div className="p-6 border-r border-line last:border-r-0 max-[720px]:[&:nth-child(2n)]:border-r-0 max-[720px]:[&:nth-child(-n+2)]:border-b max-[720px]:[&:nth-child(-n+2)]:border-line">
      <div className="label-sm-wide text-fg-3 mb-2.5">{label}</div>
      <div className="flex items-baseline">
        <span className="display-md tabular">{value}</span>
        {unit && (
          <span className="text-fg-3 text-[20px] font-normal ml-0.5">
            {unit}
          </span>
        )}
      </div>
      {progress !== null && (
        <div
          className="mt-3 h-[2px] bg-line overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      )}
      <div
        className={`body-sm text-fg-2 font-mono tracking-[0.05em] ${
          progress !== null ? "mt-2" : "mt-1.5"
        }`}
      >
        {sub}
      </div>
    </div>
  );
}
