"use client";

import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function parseIso(
  iso: string | null | undefined,
): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]) - 1,
    d: Number(match[3]),
  };
}

export function formatDisplay(iso: string) {
  const parts = parseIso(iso);
  if (!parts) return "";
  return `${pad(parts.d)} ${MONTHS[parts.m]} ${parts.y}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function firstWeekday(y: number, m: number) {
  const day = new Date(y, m, 1).getDay();
  return (day + 6) % 7;
}

type Cell = { y: number; m: number; d: number; inMonth: boolean };

function buildGrid(y: number, m: number): Cell[] {
  const first = firstWeekday(y, m);
  const dim = daysInMonth(y, m);
  const prevDim = daysInMonth(y, m - 1);
  const cells: Cell[] = [];

  for (let i = 0; i < first; i++) {
    const d = prevDim - first + 1 + i;
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    cells.push({ y: py, m: pm, d, inMonth: false });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({ y, m, d, inMonth: true });
  }
  let overflowDay = 1;
  const nmStart = m === 11 ? 0 : m + 1;
  const nyStart = m === 11 ? y + 1 : y;
  while (cells.length < 42) {
    cells.push({ y: nyStart, m: nmStart, d: overflowDay, inMonth: false });
    overflowDay++;
  }
  return cells;
}

type Props = {
  value: string | null;
  onSelect: (iso: string) => void;
  onClear?: () => void;
  showToday?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
};

export function Calendar({
  value,
  onSelect,
  onClear,
  showToday = true,
  minDate,
  maxDate,
}: Props) {
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const parts = parseIso(value);
    if (parts) return { y: parts.y, m: parts.m };
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  useEffect(() => {
    const parts = parseIso(value);
    if (parts) setCursor({ y: parts.y, m: parts.m });
  }, [value]);

  const grid = useMemo(() => buildGrid(cursor.y, cursor.m), [cursor]);
  const today = useMemo(() => {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const prev = () =>
    setCursor((c) =>
      c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 },
    );
  const next = () =>
    setCursor((c) =>
      c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 },
    );

  return (
    <div className="w-[272px]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous month"
          className="w-7 h-7 flex items-center justify-center text-fg-2 hover:text-fg hover:bg-bg-3 rounded cursor-pointer"
        >
          ‹
        </button>
        <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-fg">
          {MONTHS[cursor.m]} {cursor.y}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label="Next month"
          className="w-7 h-7 flex items-center justify-center text-fg-2 hover:text-fg hover:bg-bg-3 rounded cursor-pointer"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="font-mono text-[9px] tracking-[0.1em] uppercase text-fg-3 h-6 flex items-center justify-center"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((cell, i) => {
          const cellIso = toIso(cell.y, cell.m, cell.d);
          const isSelected = cellIso === value;
          const isToday = cellIso === today;
          const disabled =
            (minDate !== undefined && minDate !== null && cellIso < minDate) ||
            (maxDate !== undefined && maxDate !== null && cellIso > maxDate);
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onSelect(cellIso)}
              disabled={disabled}
              aria-label={formatDisplay(cellIso)}
              aria-pressed={isSelected}
              aria-disabled={disabled}
              className={`h-8 text-[12px] rounded transition-colors tabular ${
                disabled
                  ? "text-fg-4 cursor-not-allowed line-through"
                  : "cursor-pointer"
              } ${
                isSelected && !disabled
                  ? "bg-accent text-bg font-semibold"
                  : !disabled && cell.inMonth
                    ? isToday
                      ? "text-fg hover:bg-bg-3 ring-1 ring-inset ring-line-2"
                      : "text-fg hover:bg-bg-3"
                    : !disabled
                      ? "text-fg-3 hover:bg-bg-3"
                      : ""
              }`}
            >
              {cell.d}
            </button>
          );
        })}
      </div>

      {(onClear || showToday) && (
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line">
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3 hover:text-fg cursor-pointer"
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          {showToday && (
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                onSelect(toIso(t.getFullYear(), t.getMonth(), t.getDate()));
              }}
              className="font-mono text-[10px] tracking-[0.12em] uppercase text-accent hover:text-fg cursor-pointer"
            >
              Today
            </button>
          )}
        </div>
      )}
    </div>
  );
}
