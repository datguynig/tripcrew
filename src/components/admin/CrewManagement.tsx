"use client";

import { useState, useTransition } from "react";
import {
  promoteMember,
  demoteMember,
  removeMember,
} from "@/app/(app)/trips/[slug]/admin/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import type { TripRole } from "@/lib/types";

export type AdminCrewMember = {
  user_id: string;
  name: string;
  role: TripRole;
  member_joined_at: string;
};

type Props = {
  tripId: string;
  currentUserId: string;
  members: AdminCrewMember[];
};

type Action = "promote" | "demote" | "remove";

export function CrewManagement({ tripId, currentUserId, members }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<Action | null>(null);

  const admins = members.filter((m) => m.role === "admin").length;

  const run = (userId: string, action: Action, successMsg: string) => {
    const fd = new FormData();
    fd.append("tripId", tripId);
    fd.append("userId", userId);
    setBusyId(userId);
    setBusyAction(action);
    startTransition(async () => {
      const fn =
        action === "promote"
          ? promoteMember
          : action === "demote"
            ? demoteMember
            : removeMember;
      const res = await fn(undefined, fd);
      setBusyId(null);
      setBusyAction(null);
      if (res?.error) {
        toast.error(res.error);
      } else if (res?.ok) {
        toast.success(successMsg);
      }
    });
  };

  if (members.length === 0) {
    return (
      <p className="text-fg-2 text-[14px]">
        No members yet. Invites pending above.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {members.map((m) => {
        const isSelf = m.user_id === currentUserId;
        const isAdmin = m.role === "admin";
        const isLastAdmin = isAdmin && admins <= 1;
        const isBusy = pending && busyId === m.user_id;

        return (
          <li
            key={m.user_id}
            className="flex items-center justify-between gap-3 py-3 max-[520px]:flex-col max-[520px]:items-start"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-medium flex items-center gap-2">
                <span className="truncate">{m.name}</span>
                {isSelf && <Badge tone="accent">You</Badge>}
              </div>
              <Badge tone="muted" className="block mt-0.5">
                {isAdmin ? "Admin" : "Member"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0 max-[520px]:w-full max-[520px]:justify-end">
              {isSelf ? (
                <Badge tone="muted">No self-actions</Badge>
              ) : (
                <>
                  {isAdmin ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy || isLastAdmin}
                      title={
                        isLastAdmin
                          ? "Promote someone else first"
                          : "Demote to member"
                      }
                      onClick={() =>
                        run(m.user_id, "demote", `${m.name} is now a member.`)
                      }
                    >
                      {isBusy && busyAction === "demote" ? "…" : "Demote"}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        run(m.user_id, "promote", `${m.name} is now an admin.`)
                      }
                    >
                      {isBusy && busyAction === "promote" ? "…" : "Promote"}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isBusy || isLastAdmin}
                    title={
                      isLastAdmin ? "Promote someone else first" : "Remove"
                    }
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${m.name} from this trip? They'll lose access to everything.`,
                        )
                      ) {
                        run(
                          m.user_id,
                          "remove",
                          `${m.name} removed.`,
                        );
                      }
                    }}
                  >
                    {isBusy && busyAction === "remove" ? "…" : "Remove"}
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
