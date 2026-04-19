"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
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
          className="absolute top-[calc(100%+6px)] right-0 w-[240px] bg-bg-2 border border-line rounded-md shadow-lg z-50 overflow-hidden max-[520px]:fixed max-[520px]:top-[66px] max-[520px]:right-5 max-[520px]:left-5 max-[520px]:w-auto"
        >
          <div className="px-5 py-3 border-b border-line">
            <div className="label-xs text-fg-3">Signed in as</div>
            <div className="text-[13px] font-medium text-fg truncate mt-1">
              {profile.name}
            </div>
          </div>

          <Link
            href="/account"
            role="menuitem"
            data-popover-focus="first"
            className="flex items-center min-h-[44px] px-5 text-[13px] text-fg hover:bg-bg-3 active:bg-bg-3 transition-colors border-b border-line"
          >
            Account
          </Link>

          <form action="/sign-out" method="post" className="block">
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center min-h-[44px] px-5 text-[13px] text-fg hover:bg-bg-3 active:bg-bg-3 transition-colors cursor-pointer text-left"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
