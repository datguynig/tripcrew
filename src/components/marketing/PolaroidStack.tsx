import Image from "next/image";

import { SAMPLE_TRIPS, type SampleTrip } from "@/lib/marketing/sampleTrips";

type PolaroidStackProps = {
  trip: SampleTrip;
};

export function PolaroidStack({ trip }: PolaroidStackProps) {
  const others = SAMPLE_TRIPS.filter((t) => t.slug !== trip.slug).slice(0, 2);
  const stack = [trip, ...others];

  return (
    <div className="relative w-full max-w-[440px] aspect-[5/6] mx-auto">
      {stack.map((entry, index) => {
        const tilt = TILTS[index] ?? TILTS[0]!;
        return (
          <article
            key={entry.slug}
            style={{
              transform: tilt.transform,
              zIndex: stack.length - index,
              top: tilt.top,
              left: tilt.left,
            }}
            className="absolute w-[78%] bg-cream text-ink p-3 pb-7 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.85)]"
          >
            <div className="relative aspect-[4/5] bg-bg-3 overflow-hidden">
              <Image
                src={entry.heroPhotoUrl}
                alt={`${entry.city}, ${entry.vibesMeta}`}
                fill
                sizes="(min-width: 768px) 360px, 80vw"
                className="object-cover"
                priority={index === 0}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/30" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="font-mono uppercase tracking-[0.22em] text-[10px] text-ink/80">
                {entry.iata} · {entry.city}
              </span>
              <span className="font-mono uppercase tracking-[0.18em] text-[9px] text-marketing-coral">
                {entry.vibesLabel.split(" · ")[0]}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const TILTS: { transform: string; top: string; left: string }[] = [
  { transform: "rotate(-5deg)", top: "8%", left: "6%" },
  { transform: "rotate(4deg)", top: "20%", left: "20%" },
  { transform: "rotate(-2deg)", top: "32%", left: "5%" },
];
