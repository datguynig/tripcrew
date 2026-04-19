"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { code: "00", label: "Destinations", path: "/destinations" },
  { code: "01", label: "Overview", path: "" },
  { code: "02", label: "Crew", path: "/crew" },
  { code: "03", label: "Shortlist", path: "/shortlist" },
  { code: "04", label: "Bookings", path: "/bookings" },
  { code: "05", label: "Ledger", path: "/ledger" },
  { code: "06", label: "Feed", path: "/feed" },
] as const;

export function Nav({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/trips/${slug}`;
  const tabs = isAdmin
    ? [...TABS, { code: "07", label: "Admin", path: "/admin" } as const]
    : TABS;

  return (
    <div className="sticky top-[49px] z-40 bg-bg/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1280px] mx-auto px-7 max-[520px]:px-5">
        <nav className="nav-scroll flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const href = `${base}${tab.path}`;
            const active =
              tab.path === "" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={tab.path}
                href={href}
                className={`relative py-4 mr-7 pr-5 flex items-baseline gap-[10px] text-[13px] font-medium whitespace-nowrap tracking-[-0.01em] transition-colors ${
                  active ? "text-fg" : "text-fg-3 hover:text-fg"
                }`}
              >
                <span
                  aria-hidden
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
