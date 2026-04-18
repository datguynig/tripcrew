"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
  type SignInState,
} from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

type Mode = "signin" | "signup" | "magic";

function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const [mode, setMode] = useState<Mode>("signin");
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  return (
    <div className="hero-radial min-h-screen flex items-center justify-center px-7">
      <div className="w-full max-w-[460px]">
        <div className="flex items-center gap-[10px] mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          <span className="w-5 h-px bg-accent" />
          TripCrew
        </div>

        <h1 className="text-[56px] font-semibold leading-[0.95] tracking-[-0.04em] mb-[18px]">
          Plan it<br />
          together<span className="text-accent">.</span>
        </h1>

        <p className="text-fg-2 text-base leading-[1.5] mb-8">
          One app for the crew — dates, votes, bookings, money, photos.
        </p>

        {mode === "signin" && <PasswordForm mode="signin" next={next} />}
        {mode === "signup" && <PasswordForm mode="signup" next={next} />}
        {mode === "magic" && <MagicLinkForm next={next} />}

        <ModeSwitcher mode={mode} onChange={setMode} />
      </div>
    </div>
  );
}

function PasswordForm({
  mode,
  next,
}: {
  mode: "signin" | "signup";
  next: string | null;
}) {
  const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" name="email" hideLabel required>
        <input
          type="email"
          autoFocus
          placeholder="you@domain.com"
          className="bg-transparent border-0 border-b-[1.5px] border-fg-4 py-[14px] text-[22px] font-medium tracking-[-0.02em] text-fg outline-none placeholder:text-fg-3 focus:border-accent transition-colors"
        />
      </Field>
      <Field
        label="Password"
        name="password"
        hideLabel
        error={state?.error}
        required
        helper={mode === "signup" ? "At least 8 characters." : undefined}
      >
        <input
          type="password"
          minLength={8}
          placeholder="Password"
          className="bg-transparent border-0 border-b-[1.5px] border-fg-4 py-[14px] text-[22px] font-medium tracking-[-0.02em] text-fg outline-none placeholder:text-fg-3 focus:border-accent transition-colors"
        />
      </Field>
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="mt-5 uppercase tracking-[0.1em] font-semibold"
      >
        {pending
          ? mode === "signin"
            ? "Signing in…"
            : "Creating…"
          : mode === "signin"
            ? "Sign in →"
            : "Create account →"}
      </Button>
    </form>
  );
}

function MagicLinkForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    sendMagicLink,
    undefined,
  );

  if (state?.ok) {
    return (
      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg-2">
        Link sent. Check your inbox.
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" name="email" hideLabel error={state?.error} required>
        <input
          type="email"
          autoFocus
          placeholder="you@domain.com"
          className="bg-transparent border-0 border-b-[1.5px] border-fg-4 py-[14px] text-[22px] font-medium tracking-[-0.02em] text-fg outline-none placeholder:text-fg-3 focus:border-accent transition-colors"
        />
      </Field>
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="mt-5 uppercase tracking-[0.1em] font-semibold"
      >
        {pending ? "Sending…" : "Email me a link →"}
      </Button>
    </form>
  );
}

function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] tracking-[0.1em] uppercase text-fg-3">
      {mode !== "signin" && (
        <button
          type="button"
          onClick={() => onChange("signin")}
          className="hover:text-fg transition-colors cursor-pointer"
        >
          Sign in with password
        </button>
      )}
      {mode !== "signup" && (
        <button
          type="button"
          onClick={() => onChange("signup")}
          className="hover:text-fg transition-colors cursor-pointer"
        >
          Create account
        </button>
      )}
      {mode !== "magic" && (
        <button
          type="button"
          onClick={() => onChange("magic")}
          className="hover:text-fg transition-colors cursor-pointer"
        >
          Email me a link
        </button>
      )}
    </div>
  );
}
