import Link from "next/link";

import { SAMPLE_LISBON } from "@/lib/marketing/sampleTrip";

const POLAROID_LAYOUT: { rotation: string; top: string; z: number }[] = [
  { rotation: "-rotate-[5deg]", top: "0px", z: 10 },
  { rotation: "rotate-[3deg]", top: "40px", z: 20 },
  { rotation: "-rotate-[2deg]", top: "80px", z: 30 },
];

export function SampleTripTile() {
  return (
    <section
      id="sample-trip"
      className="w-full bg-ink text-cream py-24 md:py-32 px-6 md:px-10"
    >
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-12 md:mb-16">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/60 mb-5">
            See what the AI actually produces
          </p>
          <h2 className="font-serif text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
            A real trip. Real budget. Real plan. Six friends. Lisbon. Six days.
          </h2>
        </header>

        <article className="border-2 border-cream/30 p-8 md:p-12">
          <div className="grid gap-12 md:gap-16 md:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-10">
              <div>
                <h3 className="font-serif text-[44px] md:text-[56px] leading-none tracking-[-0.03em] mb-4">
                  {SAMPLE_LISBON.city}
                </h3>
                <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/60">
                  {SAMPLE_LISBON.datesLabel} · {SAMPLE_LISBON.durationLabel} ·{" "}
                  {SAMPLE_LISBON.vibesPlusLabel}
                </p>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-cream/15 border border-cream/15">
                {SAMPLE_LISBON.specCells.map((cell) => (
                  <div
                    key={cell.label}
                    className="bg-ink p-4 md:p-5 flex flex-col gap-2"
                  >
                    <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55">
                      {cell.label}
                    </dt>
                    <dd className="font-serif text-[24px] md:text-[28px] leading-none tracking-[-0.02em]">
                      {cell.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <ol className="flex flex-col gap-5">
                {SAMPLE_LISBON.schedule.map((item) => (
                  <li
                    key={item.day}
                    className="pl-4 border-l-[3px] border-marketing-coral"
                  >
                    <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55 mb-1.5">
                      {item.day} · {item.place}
                    </p>
                    <p className="text-[15px] md:text-[16px] leading-[1.55] text-cream/90">
                      {item.note}
                    </p>
                  </li>
                ))}
                <li className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/35 pt-1">
                  {SAMPLE_LISBON.totalDays - SAMPLE_LISBON.visibleDays} more
                  days · in the full plan
                </li>
              </ol>
            </div>

            <div className="hidden md:block relative min-h-[460px]">
              {SAMPLE_LISBON.polaroidCaptions.map((caption, i) => {
                const layout = POLAROID_LAYOUT[i];
                return (
                  <div
                    key={caption}
                    className={`absolute left-1/2 -translate-x-1/2 ${layout.rotation} bg-cream text-ink p-3 pb-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] w-[260px]`}
                    style={{ top: layout.top, zIndex: layout.z }}
                  >
                    <div
                      aria-hidden="true"
                      className="w-full h-[260px] bg-ink/90"
                    />
                    <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/70 mt-3 text-center">
                      {caption}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-12 md:mt-16 pt-8 border-t border-cream/15 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55">
              Shareable · group-chat-ready
            </p>
            <Link
              href="/sample-trip/lisbon"
              className="inline-flex items-center justify-center bg-cream text-ink font-mono uppercase tracking-[0.18em] text-[12px] px-7 min-h-[52px] border-2 border-cream hover:bg-transparent hover:text-cream transition-colors duration-150"
            >
              Explore the full trip →
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
