"use client";

import { useEffect, useRef, useState } from "react";
import { currencySymbol } from "@/lib/currency";

type Props = {
  amount: number;
  currency: string;
  onCommit: (next: number | null) => Promise<boolean>;
  editable: boolean;
  ariaLabel: string;
  className?: string;
  emptyLabel?: string;
  onEditingChange?: (editing: boolean) => void;
};

export function InlineMoneyEdit({
  amount,
  currency,
  onCommit,
  editable,
  ariaLabel,
  className = "",
  emptyLabel = "Add amount",
  onEditingChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(amount ? String(amount) : "");
  const [displayed, setDisplayed] = useState<number>(amount ?? 0);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const symbol = currencySymbol(currency);

  useEffect(() => {
    setDisplayed(amount ?? 0);
    if (!editing) setDraft(amount ? String(amount) : "");
  }, [amount, editing]);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = async () => {
    if (pending) return;
    const digits = draft.replace(/[^\d]/g, "");
    const parsed = digits ? Number(digits) : null;
    if ((parsed ?? 0) === displayed) {
      setEditing(false);
      return;
    }
    setPending(true);
    const ok = await onCommit(parsed);
    setPending(false);
    if (ok) {
      setDisplayed(parsed ?? 0);
      setEditing(false);
    } else {
      setDraft(displayed ? String(displayed) : "");
    }
  };

  const cancel = () => {
    setDraft(displayed ? String(displayed) : "");
    setEditing(false);
  };

  if (editing) {
    return (
      <span className={`inline-flex items-baseline ${className}`}>
        <span className="text-fg-3 mr-0.5" aria-hidden>
          {symbol}
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={() => void commit()}
          aria-label={ariaLabel}
          disabled={pending}
          className="bg-transparent border-0 border-b border-accent outline-none tabular w-[140px]"
        />
      </span>
    );
  }

  const hasAmount = displayed > 0;

  if (!editable) {
    return (
      <span className={className}>
        {hasAmount ? (
          <>
            <span className="text-fg-3 mr-0.5">{symbol}</span>
            <span className="tabular">{displayed.toLocaleString("en-US")}</span>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={`${className} cursor-text hover:underline hover:decoration-accent hover:decoration-1 hover:underline-offset-[6px] focus-visible:underline focus-visible:decoration-accent focus-visible:underline-offset-[6px]`}
    >
      {hasAmount ? (
        <>
          <span className="text-fg-3 mr-0.5">{symbol}</span>
          <span className="tabular">{displayed.toLocaleString("en-US")}</span>
        </>
      ) : (
        <span className="text-fg-4 font-mono text-[11px] tracking-[0.15em] uppercase">
          {emptyLabel}
        </span>
      )}
    </span>
  );
}
