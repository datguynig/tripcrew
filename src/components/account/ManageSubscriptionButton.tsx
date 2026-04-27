"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { createBillingPortalSession } from "@/lib/actions/subscription";

type Props = {
  label?: string;
  variant?: "primary" | "secondary";
  tone?: "accent" | "default";
  size?: "sm" | "md" | "lg";
};

export function ManageSubscriptionButton({
  label = "Manage subscription",
  variant = "secondary",
  tone = "default",
  size = "md",
}: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    });
  };

  return (
    <Button
      variant={variant}
      tone={tone}
      size={size}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Opening portal…" : label}
    </Button>
  );
}
