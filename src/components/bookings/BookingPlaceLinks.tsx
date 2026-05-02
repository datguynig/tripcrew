import type { Booking } from "@/lib/types";
import { MapPinIcon, ArrowUpRightIcon } from "@/components/ui/icons";

// Defence in depth: setBookingCustomUrl validates at write, but a misconfigured
// migration or direct DB edit could surface a non-http(s) value here.
function isSafeHref(url: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function BookingPlaceLinks({ booking }: { booking: Booking }) {
  if (isSafeHref(booking.custom_url)) {
    return (
      <a
        href={booking.custom_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 h-7 px-[10px]
          text-[11px] font-mono uppercase tracking-[0.1em] text-fg
          bg-bg-2 border border-line rounded-md
          hover:border-line-2 hover:bg-bg-3
          transition-colors shrink-0"
      >
        <span>Book</span>
        <ArrowUpRightIcon className="w-3 h-3 text-accent" />
      </a>
    );
  }

  if (!booking.maps_url && !booking.website_url) return null;

  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {booking.maps_url && (
        <IconLink
          href={booking.maps_url}
          label={`Map for ${booking.title}`}
          icon={<MapPinIcon className="w-3.5 h-3.5" />}
        />
      )}
      {booking.website_url && booking.website_url !== booking.maps_url && (
        <IconLink
          href={booking.website_url}
          label={`Website for ${booking.title}`}
          icon={<ArrowUpRightIcon className="w-3.5 h-3.5" />}
        />
      )}
    </span>
  );
}

function IconLink({
  href, label, icon,
}: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md
        text-fg-3 hover:text-fg hover:bg-bg-3
        transition-colors"
    >
      {icon}
    </a>
  );
}
