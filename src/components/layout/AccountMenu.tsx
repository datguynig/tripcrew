"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { RouteLoadingDot } from "./RouteLoadingDot";
import { getInitials } from "@/lib/initials";
import type { Profile } from "@/lib/types";

type Props = {
  profile: Profile;
};

export function AccountMenu({ profile }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || buttonRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const first = popoverRef.current?.querySelector<HTMLElement>(
      '[data-popover-focus="first"]',
    );
    first?.focus();
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${profile.name}`}
        className="w-[22px] h-[22px] bg-fg text-bg rounded-full flex items-center justify-center text-[10px] font-semibold cursor-pointer transition-transform hover:scale-[1.08] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {getInitials(profile.name)}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[240px] max-w-[calc(100vw-20px)] bg-bg-2 border border-line rounded-md shadow-lg py-2"
        >
          <Link
            href="/account"
            role="menuitem"
            data-popover-focus="first"
            className="flex items-center gap-3 px-4 py-[10px] hover:bg-bg-3 active:bg-bg-3 transition-colors"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium tracking-[-0.01em] truncate">
                Account
              </span>
              <span className="block font-mono text-[10px] tracking-[0.08em] uppercase text-fg-3 truncate">
                {profile.name}
                {profile.stripe_subscription_status === "active" &&
                  " · Crew Plus"}
                {profile.stripe_subscription_status === "trialing" &&
                  " · Crew Plus"}
                {profile.stripe_subscription_status === "past_due" &&
                  " · payment needed"}
                {profile.stripe_subscription_status === "canceled" &&
                  " · Crew Plus ending"}
              </span>
            </span>
            <RouteLoadingDot className="shrink-0" />
          </Link>

          <div className="border-t border-line mt-1 pt-1">
            <form action="/sign-out" method="post" className="block">
              <button
                type="submit"
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-[10px] text-[14px] font-medium tracking-[-0.01em] text-fg-2 hover:bg-bg-3 hover:text-fg active:bg-bg-3 transition-colors cursor-pointer text-left"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
