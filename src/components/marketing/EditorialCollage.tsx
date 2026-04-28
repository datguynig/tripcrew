import Image from "next/image";

import { SAMPLE_TRIPS, type SampleTrip } from "@/lib/marketing/sampleTrips";

type EditorialCollageProps = {
  trip: SampleTrip;
};

// Three-image editorial grid replacing the old polaroid stack on the hero.
// Sharp rectangles, no rotation, no white frames, no fake tape — labels read
// as magazine captions, not keepsake corners.
export function EditorialCollage({ trip }: EditorialCollageProps) {
  const others = SAMPLE_TRIPS.filter((t) => t.slug !== trip.slug);
  const second = others[0]!;
  const third = others[1]!;

  return (
    <div className="relative w-full max-w-[520px] mx-auto md:ml-auto md:mr-0 grid grid-cols-12 grid-rows-[repeat(8,_minmax(0,_36px))] gap-3">
      <CollageTile
        trip={trip}
        priority
        className="col-span-7 row-span-8"
        sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 60vw"
      />
      <CollageTile
        trip={second}
        className="col-span-5 row-span-4"
        sizes="(min-width: 1024px) 220px, (min-width: 640px) 35vw, 40vw"
      />
      <CollageTile
        trip={third}
        className="col-span-5 row-span-4"
        sizes="(min-width: 1024px) 220px, (min-width: 640px) 35vw, 40vw"
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
  trip: SampleTrip;
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
