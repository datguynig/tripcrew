"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onCommit: (next: string) => Promise<boolean>;
  editable: boolean;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  as?: "span" | "h1" | "h2" | "p";
  emptyLabel?: string;
  onEditingChange?: (editing: boolean) => void;
};

export function InlineEdit({
  value,
  onCommit,
  editable,
  ariaLabel,
  className = "",
  maxLength = 200,
  as = "span",
  emptyLabel = "Add",
  onEditingChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Shown value after a successful commit — stays visible while the
  // server-action roundtrip + RSC revalidate propagates the new prop.
  const [displayed, setDisplayed] = useState(value);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayed(value);
    if (!editing) setDraft(value);
  }, [value, editing]);

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
    const trimmed = draft.trim();
    if (trimmed === displayed.trim()) {
      setEditing(false);
      return;
    }
    setPending(true);
    const ok = await onCommit(trimmed);
    setPending(false);
    if (ok) {
      setDisplayed(trimmed);
      setEditing(false);
    } else {
      setDraft(displayed);
    }
  };

  const cancel = () => {
    setDraft(displayed);
    setEditing(false);
  };

  if (!editable) {
    const Tag = as;
    return <Tag className={className}>{displayed}</Tag>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
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
        maxLength={maxLength}
        aria-label={ariaLabel}
        disabled={pending}
        className={`${className} bg-transparent border-0 border-b border-accent outline-none w-full`}
      />
    );
  }

  const Tag = as;
  const hasValue = displayed.trim().length > 0;
  return (
    <Tag
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
      {hasValue ? (
        displayed
      ) : (
        <span className="text-fg-4 font-mono text-[11px] tracking-[0.15em] uppercase">
          {emptyLabel}
        </span>
      )}
    </Tag>
  );
}
