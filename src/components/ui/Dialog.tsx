"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
export const DialogPortal = RadixDialog.Portal;

export function DialogContent({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
  children: ReactNode;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-bg/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out z-40" />
      <RadixDialog.Content
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(440px,calc(100vw-32px))] bg-bg-2 border border-line-2 rounded-md p-7 z-50 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out ${className}`}
        {...props}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogTitle({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof RadixDialog.Title>) {
  return (
    <RadixDialog.Title
      className={`text-[20px] font-medium tracking-[-0.02em] mb-2 ${className}`}
      {...props}
    >
      {children}
    </RadixDialog.Title>
  );
}

export function DialogDescription({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description
      className={`text-fg-2 text-sm leading-[1.55] mb-6 ${className}`}
      {...props}
    >
      {children}
    </RadixDialog.Description>
  );
}
