"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-center"
      duration={4500}
      toastOptions={{
        classNames: {
          toast:
            "!bg-bg-2 !border !border-line-2 !text-fg !rounded-md !font-sans !text-sm !shadow-none",
          description: "!text-fg-2 !text-xs",
          actionButton:
            "!bg-fg !text-bg !rounded-md !text-xs !font-medium !px-3 !py-1.5",
          cancelButton:
            "!bg-bg-3 !text-fg-2 !rounded-md !text-xs !font-medium !px-3 !py-1.5",
        },
      }}
    />
  );
}
