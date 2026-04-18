"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/hooks/useToast";
import { createInvite, revokeInvite } from "@/lib/actions/invites";
import type { TripInvite } from "@/lib/types";

type Props = {
  tripId: string;
  origin: string;
  initial: TripInvite[];
};

type InviteRow = {
  id: string;
  token: string;
  url: string;
  expires_at: string;
  invited_at: string;
};

function toRow(invite: TripInvite, origin: string): InviteRow | null {
  if (!invite.token || !invite.expires_at) return null;
  return {
    id: invite.id,
    token: invite.token,
    url: `${origin}/join/${invite.token}`,
    expires_at: invite.expires_at,
    invited_at: invite.invited_at,
  };
}

function formatExpiry(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  return "<1h left";
}

export function InvitePanel({ tripId, origin, initial }: Props) {
  const [invites, setInvites] = useState<InviteRow[]>(
    () =>
      initial
        .map((i) => toRow(i, origin))
        .filter((r): r is InviteRow => r !== null)
        .filter((r) => new Date(r.expires_at).getTime() > Date.now()),
  );
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createInvite(tripId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const row: InviteRow = {
        id: res.id,
        token: res.token,
        url: res.url,
        expires_at: res.expiresAt,
        invited_at: new Date().toISOString(),
      };
      setInvites((prev) => [row, ...prev]);
      try {
        await navigator.clipboard.writeText(res.url);
        toast.success("Invite link copied. Share it with your crew.");
      } catch {
        toast.info("Invite created. Copy the link manually below.");
      }
    });
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Copy failed. Select the text to copy manually.");
    }
  };

  const handleRevoke = (id: string) => {
    const row = invites.find((r) => r.id === id);
    if (!row) return;
    setInvites((prev) => prev.filter((r) => r.id !== id));
    toast.undo({
      message: "Invite revoked.",
      duration: 5000,
      onUndo: () =>
        setInvites((prev) =>
          [row, ...prev].sort(
            (a, b) =>
              new Date(b.invited_at).getTime() -
              new Date(a.invited_at).getTime(),
          ),
        ),
      onCommit: () =>
        startTransition(async () => {
          const res = await revokeInvite(id);
          if (!res.ok) {
            toast.error("Revoke failed. Refresh to retry.");
          }
        }),
    });
  };

  return (
    <Card padding={7} tone="flat" className="mt-8">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent mb-1">
            Invite
          </div>
          <h3 className="text-[20px] font-medium tracking-[-0.02em]">
            Share a link to join
          </h3>
          <p className="text-fg-2 text-[13px] mt-1 max-w-[520px]">
            Anyone with the link can join this trip for {7} days. Revoke any
            time.
          </p>
        </div>
        <Button
          variant="primary"
          tone="accent"
          onClick={handleCreate}
          disabled={pending}
        >
          {pending ? "Creating…" : "+ New link"}
        </Button>
      </div>

      {invites.length === 0 ? (
        <div className="border border-dashed border-line-2 py-8 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
          No active invite links
        </div>
      ) : (
        <div className="border border-line divide-y divide-line">
          {invites.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-3 px-4 max-[640px]:grid-cols-1"
            >
              <input
                type="text"
                readOnly
                value={row.url}
                onFocus={(e) => e.currentTarget.select()}
                className="bg-bg-2 border border-line px-3 py-2 text-[12px] font-mono rounded-md outline-none focus:border-line-2 truncate"
              />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-fg-3">
                  {formatExpiry(row.expires_at)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(row.url)}
                >
                  Copy
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRevoke(row.id)}
                aria-label="Revoke invite"
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
