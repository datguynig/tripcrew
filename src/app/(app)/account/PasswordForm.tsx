"use client";

import { useActionState, useEffect } from "react";
import { updatePassword, type UpdatePasswordState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/hooks/useToast";
import { INPUT_SM } from "@/lib/styles";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<
    UpdatePasswordState,
    FormData
  >(updatePassword, undefined);
  const toast = useToast();

  useEffect(() => {
    if (state?.ok) toast.success("Password updated.");
  }, [state, toast]);

  return (
    <form action={formAction} className="grid gap-5 max-w-[400px]">
      <Field
        label="New password"
        name="password"
        error={state?.error}
        helper="At least 8 characters."
        required
      >
        <input
          type="password"
          minLength={8}
          autoComplete="new-password"
          className={INPUT_SM}
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
