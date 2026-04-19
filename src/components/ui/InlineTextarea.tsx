"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onCommit: (next: string) => Promise<boolean>;
  editable: boolean;
  ariaLabel: string;
  className?: string;
  maxLength?: number;
  emptyLabel?: string;
  onEditingChange?: (editing: boolean) => void;
};

export function InlineTextarea({
  value,
  onCommit,
  editable,
  ariaLabel,
  className = "",
  maxLength = 500,
  emptyLabel = "Add",
  onEditingChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [displayed, setDisplayed] = useState(value);
  const [pending, setPending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDisplayed(value);
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  useEffect(() => {
    if (!editing || !taRef.current) return;
    taRef.current.focus();
    taRef.current.select();
    autoSize(taRef.current);
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
    return <p className={className}>{displayed}</p>;
  }

  if (editing) {
    return (
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          autoSize(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
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
        rows={2}
        className={`${className} bg-transparent border-0 border-b border-accent outline-none w-full resize-none`}
      />
    );
  }

  const hasValue = displayed.trim().length > 0;
  return (
    <p
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
    </p>
  );
}

function autoSize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
