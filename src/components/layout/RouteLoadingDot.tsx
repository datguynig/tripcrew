"use client";

import { useLinkStatus } from "next/link";

/**
 * Accent pulse dot rendered while the enclosing <Link> is mid-transition.
 * Drop as a sibling of the link's label content; renders nothing at rest.
 *
 * Must live INSIDE a `<Link>` — useLinkStatus is only valid in Link
 * descendants. Gives touch users an immediate "your tap is working"
 * signal on slow connections, especially when the destination route
 * has its own server-side fetches to resolve.
 */
export function RouteLoadingDot({
  className = "",
}: {
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-label="Loading"
      className={`inline-block w-[6px] h-[6px] rounded-full bg-accent animate-pulse ${className}`}
    />
  );
}
