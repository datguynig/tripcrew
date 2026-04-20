"use client";

import { useEffect, useState } from "react";
import { currencySymbol } from "@/lib/currency";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { InlineTextarea } from "@/components/ui/InlineTextarea";
import { ProgressRail } from "@/components/ui/ProgressRail";
import { updateHeroField } from "@/lib/actions/overviewInline";
import { useToast } from "@/hooks/useToast";

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
  tripId: string;
  isAdmin: boolean;
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
  tripId,
  isAdmin,
}: Props) {
  const toast = useToast();
  const symbol = currencySymbol(currency);
  const [days, setDays] = useState(() =>
    startDate ? daysUntil(startDate) : null,
  );

  useEffect(() => {
    if (!startDate) return;
    const id = setInterval(() => setDays(daysUntil(startDate)), 60_000);
    return () => clearInterval(id);
  }, [startDate]);

  const commit = async (
    field: "hero_title" | "hero_subtitle",
    value: string,
  ): Promise<boolean> => {
    const res = await updateHeroField({ tripId, field, value });
    if (res?.error) {
      toast.error(res.error);
      return false;
    }
    return true;
  };

  return (
    <div className="pt-[70px] pb-[60px] border-b border-line relative">
      <div className="flex flex-wrap gap-x-7 gap-y-2 mb-10 label text-fg-3">
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
        <InlineEdit
          value={heroTitle}
          onCommit={(v) => commit("hero_title", v)}
          editable={isAdmin}
          as="span"
          maxLength={80}
          ariaLabel="Edit trip title"
          emptyLabel="Add title"
          className="inline"
        />
        <span className="text-accent">.</span>
      </h1>

      {(isAdmin || heroSubtitle) && (
        <div className="max-w-[620px] text-[18px] leading-[1.5] text-fg-2">
          <InlineTextarea
            value={heroSubtitle ?? ""}
            onCommit={(v) => commit("hero_subtitle", v)}
            editable={isAdmin}
            maxLength={300}
            ariaLabel="Edit trip subtitle"
            emptyLabel="Add a subtitle — one line, editorial."
            className="block"
          />
        </div>
      )}

      <div className="mt-14 grid grid-cols-4 max-[780px]:grid-cols-2 max-[400px]:grid-cols-1 border-t border-line">
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
    <div className="p-6 border-r border-line last:border-r-0 max-[780px]:[&:nth-child(2n)]:border-r-0 max-[780px]:[&:nth-child(-n+2)]:border-b max-[780px]:[&:nth-child(-n+2)]:border-line max-[400px]:!border-r-0 max-[400px]:border-b max-[400px]:last:border-b-0">
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
        <ProgressRail value={progress} label={`${label} progress`} className="mt-3" />
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
