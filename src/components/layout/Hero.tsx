"use client";

import { useEffect, useState } from "react";
import { TRIP_START, HERO_SUB } from "@/constants/trip";

function daysUntil(iso: string) {
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}

type Props = {
  crewCount: number;
  targetCrew: number;
  bookingsDone: number;
  bookingsTotal: number;
  kittyTotal: number;
  targetBudgetPp: number;
};

export function Hero({
  crewCount,
  targetCrew,
  bookingsDone,
  bookingsTotal,
  kittyTotal,
  targetBudgetPp,
}: Props) {
  const [days, setDays] = useState(() => daysUntil(TRIP_START));

  useEffect(() => {
    const id = setInterval(() => setDays(daysUntil(TRIP_START)), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pt-[70px] pb-[60px] border-b border-line relative">
      <div className="flex flex-wrap gap-7 mb-10 font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
        <span>
          LOC / <b className="text-fg font-medium">Stockholm, SE</b>
        </span>
        <span>
          DATES / <b className="text-fg font-medium">23 – 26 Jul 26</b>
        </span>
        <span>
          CREW /{" "}
          <b className="text-fg font-medium">
            {crewCount} / {targetCrew}
          </b>
        </span>
        <span>
          STATUS / <b className="text-fg font-medium">ACTIVE</b>
        </span>
      </div>

      <h1
        className="font-bold leading-[0.88] mb-7"
        style={{
          fontSize: "clamp(64px, 13vw, 180px)",
          letterSpacing: "-0.055em",
        }}
      >
        Stockholm<span className="text-accent">.</span>
      </h1>

      <p className="max-w-[620px] text-[18px] leading-[1.5] text-fg-2">
        {HERO_SUB}
      </p>

      <div className="mt-14 grid grid-cols-4 max-[720px]:grid-cols-2 border-t border-line">
        <StatCell
          label="T-Minus"
          value={days.toString()}
          unit="d"
          sub="Until wheels up"
        />
        <StatCell
          label="Target budget"
          value={`£${targetBudgetPp}`}
          unit="pp"
          sub="Ex. flights"
        />
        <StatCell
          label="Bookings"
          value={`${bookingsDone}/${bookingsTotal}`}
          sub="Locked in"
        />
        <StatCell
          label="Kitty"
          value={`£${kittyTotal.toFixed(0)}`}
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
