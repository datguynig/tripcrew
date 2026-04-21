"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

const TABS = [
  { code: "00", label: "Destinations", path: "/destinations" },
  { code: "01", label: "Overview", path: "" },
  { code: "02", label: "Crew", path: "/crew" },
  { code: "03", label: "Shortlist", path: "/shortlist" },
  { code: "04", label: "Bookings", path: "/bookings" },
  { code: "05", label: "Ledger", path: "/ledger" },
  { code: "06", label: "Feed", path: "/feed" },
] as const;

type Tab = {
  code: string;
  label: string;
  path: string;
};

export function Nav({
  slug,
  isAdmin,
  tripId,
}: {
  slug: string;
  isAdmin: boolean;
  tripId: string;
}) {
  const pathname = usePathname();
  const { feedUnreadByTrip } = useNotifications();
  const feedUnread = feedUnreadByTrip[tripId] ?? 0;
  const base = `/trips/${slug}`;
  const tabs: Tab[] = isAdmin
    ? [...TABS, { code: "07", label: "Admin", path: "/admin" }]
    : [...TABS];

  return (
    <div className="sticky top-[60px] z-40 bg-bg/85 backdrop-blur-md border-b border-line">
      <div className="max-w-[1280px] mx-auto">
        <nav className="nav-scroll flex gap-0 overflow-x-auto px-7 max-[520px]:px-5">
          {tabs.map((tab) => {
            const href = `${base}${tab.path}`;
            const active =
              tab.path === "" ? pathname === href : pathname.startsWith(href);
            const isFeedTab = tab.path === "/feed";
            return (
              <Link
                key={tab.path}
                href={href}
                className={`relative py-4 mr-7 pr-5 flex items-baseline gap-[10px] text-[13px] font-medium whitespace-nowrap tracking-[-0.01em] transition-colors ${
                  active
                    ? "text-fg"
                    : "text-fg-3 hover:text-fg active:text-fg"
                }`}
              >
                <TabContent
                  tab={tab}
                  active={active}
                  isFeedTab={isFeedTab}
                  feedUnread={feedUnread}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function TabContent({
  tab,
  active,
  isFeedTab,
  feedUnread,
}: {
  tab: Tab;
  active: boolean;
  isFeedTab: boolean;
  feedUnread: number;
}) {
  // `useLinkStatus` is valid inside Link descendants; returns pending=true
  // while the route transition is in flight. Gives mobile users an
  // indicator that their tap registered and something is happening,
  // especially on slow connections.
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        aria-hidden
        className={`font-mono text-[10px] tracking-[0.1em] ${
          active ? "text-accent" : "text-fg-4"
        }`}
      >
        {tab.code}
      </span>
      <span>{tab.label}</span>
      {pending ? (
        <span
          aria-label="Loading"
          className="w-[6px] h-[6px] rounded-full bg-accent animate-pulse"
        />
      ) : (
        isFeedTab &&
        feedUnread > 0 && (
          <span
            aria-label={`${feedUnread} unread`}
            className="font-mono text-[10px] tracking-[0.1em] text-accent tabular"
          >
            {feedUnread}
          </span>
        )
      )}
      {active && (
        <span className="absolute -bottom-px left-0 right-5 h-[2px] bg-accent" />
      )}
    </>
  );
}
