"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { code: "01", label: "Overview", href: "/" },
  { code: "02", label: "Crew", href: "/crew" },
  { code: "03", label: "Shortlist", href: "/shortlist" },
  { code: "04", label: "Bookings", href: "/bookings" },
  { code: "05", label: "Ledger", href: "/ledger" },
  { code: "06", label: "Feed", href: "/feed" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-[49px] z-40 bg-bg/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1280px] mx-auto px-7">
        <nav className="nav-scroll flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const active =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative py-4 mr-7 pr-5 flex items-baseline gap-[10px] text-[13px] font-medium whitespace-nowrap tracking-[-0.01em] transition-colors ${
                  active ? "text-fg" : "text-fg-3 hover:text-fg"
                }`}
              >
                <span
                  className={`font-mono text-[10px] tracking-[0.1em] ${
                    active ? "text-accent" : "text-fg-4"
                  }`}
                >
                  {tab.code}
                </span>
                <span>{tab.label}</span>
                {active && (
                  <span className="absolute -bottom-px left-0 right-5 h-[2px] bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
