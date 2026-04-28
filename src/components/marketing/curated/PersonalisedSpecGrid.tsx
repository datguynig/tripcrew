import type { TeaserInputs, TeaserOutput } from "@/lib/types";

type PersonalisedSpecGridProps = {
  spec: TeaserOutput["spec"];
  inputs: TeaserInputs;
};

/**
 * Four-cell grid showing the visitor's personalised spec, mirrored back
 * from the teaser output. Visually matches the typical-spec strip so
 * the gate-to-personalised flip feels like the same surface, recoloured
 * with the visitor's data.
 */
export function PersonalisedSpecGrid({ spec, inputs: _inputs }: PersonalisedSpecGridProps) {
  const cells = [
    { label: "Per head", value: spec.perHead },
    { label: "Crew", value: spec.crew },
    { label: "Origin", value: spec.origin },
    { label: "Vibes", value: spec.vibes },
  ];

  return (
    <section className="border-y-2 border-ink bg-cream">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-12 md:py-16">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep mb-7">
          <span
            aria-hidden="true"
            className="inline-block w-[8px] h-[8px] bg-marketing-coral-deep mr-3 align-middle"
          />
          Your version · scaled to your crew
        </p>

        <dl className="grid grid-cols-2 md:grid-cols-4 border-2 border-ink">
          {cells.map((cell, i) => (
            <div
              key={cell.label}
              className={[
                "p-5 md:p-6 flex flex-col gap-2",
                i % 2 === 1 ? "border-l-2 border-ink/15" : "",
                i >= 2 ? "border-t-2 border-ink/15 md:border-t-0" : "",
                i === 2 ? "md:border-l-2 md:border-ink/15" : "",
                i === 3 ? "md:border-l-2 md:border-ink/15" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <dt className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
                {cell.label}
              </dt>
              <dd className="font-serif text-[24px] md:text-[30px] leading-[1.1] tracking-[-0.02em] truncate">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
