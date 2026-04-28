import Image from "next/image";

import { CURATED_TRIPS, type CuratedTrip } from "@/lib/marketing/curatedTrips";

type EditorialCollageProps = {
  trip: CuratedTrip;
};

// Three-image editorial grid replacing the old polaroid stack on the hero.
// Sharp rectangles, no rotation, no white frames, no fake tape — labels read
// as magazine captions, not keepsake corners.
export function EditorialCollage({ trip }: EditorialCollageProps) {
  const others = CURATED_TRIPS.filter((t) => t.slug !== trip.slug);
  const second = others[0]!;
  const third = others[1]!;

  return (
    <div className="relative w-full max-w-[520px] mx-auto md:ml-auto md:mr-0 grid grid-cols-12 grid-rows-[repeat(8,_minmax(0,_38px))] gap-2">
      <CollageTile
        trip={trip}
        priority
        className="col-span-8 row-span-8"
        sizes="(min-width: 1024px) 340px, (min-width: 640px) 55vw, 65vw"
      />
      <CollageTile
        trip={second}
        className="col-span-4 row-span-3"
        sizes="(min-width: 1024px) 170px, (min-width: 640px) 28vw, 32vw"
      />
      <CollageTile
        trip={third}
        className="col-span-4 row-span-5"
        sizes="(min-width: 1024px) 170px, (min-width: 640px) 28vw, 32vw"
      />
    </div>
  );
}

function CollageTile({
  trip,
  className,
  priority = false,
  sizes,
}: {
  trip: CuratedTrip;
  className: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <figure
      className={`relative overflow-hidden bg-bg-3 ${className}`}
    >
      <Image
        src={trip.heroPhotoUrl}
        alt={`${trip.city}, ${trip.country}`}
        fill
        sizes={sizes}
        className="object-cover"
        priority={priority}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
      <figcaption className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-mono uppercase tracking-[0.18em] text-[9px] text-cream/85">
            {trip.country}
          </span>
          <span className="font-serif text-[18px] leading-none tracking-[-0.015em] text-cream">
            {trip.city}
          </span>
        </div>
        <span className="font-mono uppercase tracking-[0.18em] text-[9px] text-marketing-coral whitespace-nowrap">
          {trip.vibesLabel.split(" · ")[0]}
        </span>
      </figcaption>
    </figure>
  );
}
