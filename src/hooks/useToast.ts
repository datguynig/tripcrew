"use client";

import { toast as sonnerToast } from "sonner";

type UndoOpts = {
  message: string;
  duration?: number;
  onUndo: () => void;
  onCommit: () => void | Promise<void>;
};

type ReversibleOpts = {
  message: string;
  actionLabel?: string;
  duration?: number;
  onAction: () => void | Promise<void>;
};

export function useToast() {
  const success = (message: string) => sonnerToast.success(message);
  const error = (message: string) => sonnerToast.error(message);
  const info = (message: string) => sonnerToast(message);

  const undo = ({ message, duration = 5000, onUndo, onCommit }: UndoOpts) => {
    let undone = false;

    const id = sonnerToast(message, {
      duration,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          onUndo();
          sonnerToast.dismiss(id);
        },
      },
    });

    setTimeout(() => {
      if (!undone) {
        void onCommit();
      }
    }, duration);
  };

  // Like `undo`, but for cases where the server has already committed.
  // The action button fires a reversal; if the user ignores the toast,
  // nothing else happens. No auto-commit timer.
  const reversible = ({
    message,
    actionLabel = "Undo",
    duration = 8000,
    onAction,
  }: ReversibleOpts) => {
    const id = sonnerToast(message, {
      duration,
      action: {
        label: actionLabel,
        onClick: () => {
          void onAction();
          sonnerToast.dismiss(id);
        },
      },
    });
  };

  return { success, error, info, undo, reversible };
}
