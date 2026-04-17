"use client";

import { toast as sonnerToast } from "sonner";

type UndoOpts = {
  message: string;
  duration?: number;
  onUndo: () => void;
  onCommit: () => void | Promise<void>;
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

  return { success, error, info, undo };
}
