"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  storageKey: string;
  defaultOpen: boolean;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CollapsibleSection({
  storageKey,
  defaultOpen,
  summary,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "open") setOpen(true);
      else if (stored === "closed") setOpen(false);
    } catch {
      // ignore — private mode etc.
    }
  }, [storageKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(storageKey, next ? "open" : "closed");
    } catch {
      // ignore
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 border border-line bg-bg-2 hover:bg-bg-3 transition-colors text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">{summary}</div>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`w-4 h-4 text-fg-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && <div className="mt-6">{children}</div>}
    </div>
  );
}
