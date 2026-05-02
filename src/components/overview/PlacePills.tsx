import type { ScheduleItemPlace } from "@/lib/types";
import { MapPinIcon, ArrowUpRightIcon } from "@/components/ui/icons";

type Props = { places: ScheduleItemPlace[] };

export function PlacePills({ places }: Props) {
  const resolved = places.filter((p) => p.place_id !== null && p.maps_url);
  if (resolved.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="label-sm text-fg-3">PLACES</div>
      <div className="flex flex-wrap gap-1.5">
        {resolved.slice(0, 4).map((p) => (
          <PlacePill key={p.place_id} place={p} />
        ))}
      </div>
    </div>
  );
}

function PlacePill({ place }: { place: ScheduleItemPlace }) {
  const showWebsite =
    place.website_url && place.website_url !== place.maps_url;

  return (
    <span className="inline-flex items-stretch">
      <a
        href={place.maps_url!}
        target="_blank"
        rel="noopener noreferrer"
        title={place.name}
        className={`inline-flex items-center gap-1.5 py-[5px] px-[10px] text-[12px]
          bg-bg-2 border border-line text-fg-2
          hover:bg-bg-3 hover:border-line-2 hover:text-fg
          transition-colors
          ${showWebsite ? "rounded-l-full border-r-0" : "rounded-full"}`}
      >
        <MapPinIcon className="w-3 h-3 text-fg-3 shrink-0" />
        <span className="truncate max-w-[180px]">{place.name}</span>
      </a>
      {showWebsite && (
        <a
          href={place.website_url!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${place.name} website`}
          className="inline-flex items-center px-[8px] text-fg-3 text-[12px]
            bg-bg-2 border border-line border-l border-l-line-2/60
            rounded-r-full
            hover:bg-bg-3 hover:border-line-2 hover:text-fg
            transition-colors"
        >
          <ArrowUpRightIcon className="w-3 h-3" />
        </a>
      )}
    </span>
  );
}
