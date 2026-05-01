"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendConciergeMessage } from "@/lib/actions/concierge";
import { Button } from "@/components/ui/Button";
import { ConciergeMessageBubble } from "./ConciergeMessageBubble";
import type { ConciergeMessage } from "@/lib/types";

type Props = {
  tripId: string;
  initialMessages: ConciergeMessage[];
  userName: string;
};

export function Concierge({ tripId, initialMessages, userName }: Props) {
  const [messages, setMessages] = useState<ConciergeMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isPending]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || isPending) return;

    setError(null);
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "0";
      textareaRef.current.style.height = "44px";
    }

    startTransition(async () => {
      const result = await sendConciergeMessage({ tripId, body });
      if ("ok" in result && result.ok) {
        setMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
      } else {
        setError(result.error);
        setDraft(body);
      }
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleProposalApplied(updated: ConciergeMessage) {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  return (
    <div className="mt-8 grid gap-6 max-w-[760px]">
      <div className="border border-line bg-bg-2 min-h-[420px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-5 grid gap-4 max-h-[60vh]">
          {messages.length === 0 ? (
            <Empty userName={userName} />
          ) : (
            messages.map((m) => (
              <ConciergeMessageBubble
                key={m.id}
                message={m}
                onProposalApplied={handleProposalApplied}
              />
            ))
          )}
          {isPending && (
            <div className="text-[13px] text-fg-3 italic">Concierge is thinking…</div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-line p-3 flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              autoGrow(e.currentTarget);
            }}
            onKeyDown={onKeyDown}
            placeholder="Ask the concierge to refine the trip…"
            rows={1}
            disabled={isPending}
            className="flex-1 bg-bg text-fg placeholder:text-fg-3 border border-line rounded-md px-3 py-[10px] text-[14px] leading-[1.45] resize-none focus-visible:outline-none focus-visible:border-line-2 disabled:opacity-60"
            style={{ height: "44px" }}
          />
          <Button type="submit" variant="primary" disabled={!draft.trim() || isPending}>
            Send
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-err">
          {error}
        </p>
      )}

      <p className="text-[12px] text-fg-3 leading-[1.5]">
        The concierge sees your trip plan and can search Google Places. Anything
        it suggests as a change comes back as an Apply card. Conversations are
        private to you, even on shared trips.
      </p>
    </div>
  );
}

function Empty({ userName }: { userName: string }) {
  const examples = [
    "Suggest a quieter dinner spot for night 2.",
    "Bump the budget to £200pp and rework day 3.",
    "Find a sunset boat tour we can fit on day 4.",
  ];
  return (
    <div className="grid gap-4 py-6">
      <p className="text-[15px] text-fg-2 leading-[1.5]">
        Hey {userName}. What do you want to refine?
      </p>
      <ul className="grid gap-2">
        {examples.map((ex) => (
          <li
            key={ex}
            className="text-[13px] text-fg-3 italic border-l-2 border-line pl-3"
          >
            "{ex}"
          </li>
        ))}
      </ul>
    </div>
  );
}
