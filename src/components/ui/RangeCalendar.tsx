"use client";

import { useMemo, useState } from "react";
import { formatDisplay, parseIso, toIso } from "./Calendar";

/**
 * Dual-month range calendar. Two grids side-by-side; prev/next move
 * both together. Click start → click end → done. Clicking before
 * start resets start; clicking after end with a completed range
 * restarts selection at the new click.
 *
 * Range visualization: start + end are accent-filled cells; cells in
 * between are tinted with accent-dim. A hover preview mirrors the
 * tint while the user is picking the end date.
 */

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

type Cell = { y: number; m: number; d: number; inMonth: boolean };

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function firstWeekday(y: number, m: number) {
  const day = new Date(y, m, 1).getDay();
  return (day + 6) % 7;
}
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
  for (let d = 1; d <= dim; d++) cells.push({ y, m, d, inMonth: true });
  let overflow = 1;
  const nmStart = m === 11 ? 0 : m + 1;
  const nyStart = m === 11 ? y + 1 : y;
  while (cells.length < 42) {
    cells.push({ y: nyStart, m: nmStart, d: overflow, inMonth: false });
    overflow++;
  }
  return cells;
}

type Props = {
  start: string | null;
  end: string | null;
  onChange: (next: { start: string | null; end: string | null }) => void;
  minDate?: string | null;
  maxDate?: string | null;
};

export function RangeCalendar({
  start,
  end,
  onChange,
  minDate,
  maxDate,
}: Props) {
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const parts = parseIso(start) ?? parseIso(end);
    if (parts) return { y: parts.y, m: parts.m };
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const [hovering, setHovering] = useState<string | null>(null);

  const second = useMemo(
    () => (cursor.m === 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m: cursor.m + 1 }),
    [cursor],
  );

  const prev = () =>
    setCursor((c) =>
      c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 },
    );
  const next = () =>
    setCursor((c) =>
      c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 },
    );

  const handleClick = (iso: string) => {
    if (minDate && iso < minDate) return;
    if (maxDate && iso > maxDate) return;

    // No selection yet — set as start.
    if (!start) {
      onChange({ start: iso, end: null });
      return;
    }
    // Start set, no end yet. Figure out if this is the end or a reset.
    if (start && !end) {
      if (iso < start) {
        onChange({ start: iso, end: null });
      } else if (iso === start) {
        onChange({ start: iso, end: iso });
      } else {
        onChange({ start, end: iso });
      }
      return;
    }
    // Both set. Any click restarts selection.
    onChange({ start: iso, end: null });
  };

  // Preview end: if the user has a start but no end and is hovering,
  // treat the hovered cell as a virtual end for range tinting.
  const effectiveEnd = end ?? (start && hovering && hovering >= start ? hovering : null);

  const today = useMemo(() => {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  return (
    <div className="w-[576px] max-[640px]:w-[288px]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous month"
          className="w-7 h-7 flex items-center justify-center text-fg-2 hover:text-fg hover:bg-bg-3 rounded cursor-pointer"
        >
          ‹
        </button>
        <div className="flex-1 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <div className="label text-fg text-center">
            {MONTHS[cursor.m]} {cursor.y}
          </div>
          <div className="label text-fg text-center max-[640px]:hidden">
            {MONTHS[second.m]} {second.y}
          </div>
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

      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <MonthGrid
          y={cursor.y}
          m={cursor.m}
          start={start}
          end={effectiveEnd}
          today={today}
          minDate={minDate}
          maxDate={maxDate}
          onClick={handleClick}
          onHover={setHovering}
        />
        <div className="max-[640px]:hidden">
          <MonthGrid
            y={second.y}
            m={second.m}
            start={start}
            end={effectiveEnd}
            today={today}
            minDate={minDate}
            maxDate={maxDate}
            onClick={handleClick}
            onHover={setHovering}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line">
        <button
          type="button"
          onClick={() => onChange({ start: null, end: null })}
          className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3 hover:text-fg cursor-pointer"
        >
          Clear
        </button>
        <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-fg-3 tabular">
          {start ? formatDisplay(start) : "—"}
          <span className="mx-2 text-fg-4">→</span>
          {end ? formatDisplay(end) : start ? "pick end" : "—"}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  y,
  m,
  start,
  end,
  today,
  minDate,
  maxDate,
  onClick,
  onHover,
}: {
  y: number;
  m: number;
  start: string | null;
  end: string | null;
  today: string;
  minDate?: string | null;
  maxDate?: string | null;
  onClick: (iso: string) => void;
  onHover: (iso: string | null) => void;
}) {
  const grid = useMemo(() => buildGrid(y, m), [y, m]);

  return (
    <div>
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
          const iso = toIso(cell.y, cell.m, cell.d);
          const disabled =
            (!!minDate && iso < minDate) || (!!maxDate && iso > maxDate);
          const isStart = !!start && iso === start;
          const isEnd = !!end && iso === end;
          const inRange =
            !!start && !!end && iso > start && iso < end && cell.inMonth;
          const isToday = iso === today;

          let bg = "";
          if (isStart || isEnd) {
            bg = "bg-accent text-bg font-semibold";
          } else if (inRange) {
            bg = "bg-accent/15 text-fg";
          } else if (disabled) {
            bg = "text-fg-4 cursor-not-allowed line-through";
          } else if (cell.inMonth) {
            bg = isToday
              ? "text-fg hover:bg-bg-3 ring-1 ring-inset ring-line-2"
              : "text-fg hover:bg-bg-3";
          } else {
            bg = "text-fg-3 hover:bg-bg-3";
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onClick(iso)}
              onMouseEnter={() => !disabled && onHover(iso)}
              onMouseLeave={() => onHover(null)}
              disabled={disabled}
              aria-label={formatDisplay(iso)}
              aria-pressed={isStart || isEnd}
              className={`h-8 text-[12px] rounded transition-colors tabular ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              } ${bg}`}
            >
              {cell.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
