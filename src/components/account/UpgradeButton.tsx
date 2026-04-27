"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { createCheckoutSession } from "@/lib/actions/subscription";

type Props = {
  label?: string;
  tone?: "accent" | "default";
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
};

export function UpgradeButton({
  label = "Start 7-day free trial →",
  tone = "accent",
  size = "lg",
  variant = "primary",
}: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createCheckoutSession();
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
      {pending ? "Opening checkout…" : label}
    </Button>
  );
}
