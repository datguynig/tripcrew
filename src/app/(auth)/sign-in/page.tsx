"use client";

import { useActionState } from "react";
import { sendMagicLink, type SignInState } from "./actions";
import { Button } from "@/components/ui/Button";

export default function SignInPage() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    sendMagicLink,
    undefined,
  );

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
          One app for the crew — dates, votes, bookings, money, photos. Sign in
          with your email to start or join a trip.
        </p>

        {state?.ok ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg-2">
            Link sent. Check your inbox.
          </div>
        ) : (
          <form action={action} className="grid gap-3">
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="you@domain.com"
              className="bg-transparent border-0 border-b-[1.5px] border-fg-4 py-[14px] text-[22px] font-medium tracking-[-0.02em] text-fg outline-none placeholder:text-fg-4 focus:border-accent transition-colors"
            />
            {state?.error && (
              <div className="text-err font-mono text-[11px] uppercase tracking-[0.1em]">
                {state.error}
              </div>
            )}
            <Button
              type="submit"
              disabled={pending}
              size="lg"
              className="mt-5 uppercase tracking-[0.1em] font-semibold"
            >
              {pending ? "Sending…" : "Enter →"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
