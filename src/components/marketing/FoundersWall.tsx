import Link from "next/link";
import { RevealOnView } from "@/components/motion";
import { PioneerBadge } from "@/components/ui/PioneerBadge";

type Founder = {
  number: number;
  name: string | null;
  joinedAt: string;
};

export function FoundersWall({
  founders,
  totalSeats,
}: {
  founders: Founder[];
  totalSeats: number;
}) {
  const claimed = founders.length;
  const remaining = Math.max(0, totalSeats - claimed);
  const reverseOrder = [...founders].reverse();

  return (
    <section className="bg-cream text-ink min-h-screen">
      <div className="mx-auto max-w-[1080px] px-6 sm:px-10 py-24 md:py-32">
        <RevealOnView className="flex flex-col gap-6 mb-20">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            The Pioneers
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <PioneerBadge size="lg" />
            <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/65">
              Price-locked for life
            </p>
          </div>
          <h1 className="font-serif text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.025em] max-w-[18ch]">
            The {claimed}{" "}
            <span className="font-serif italic">building it with us.</span>
          </h1>
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/65">
            {remaining} of {totalSeats} seats remain ·{" "}
            <Link
              href="/apply?intent=founding"
              className="text-marketing-coral-deep underline underline-offset-4 hover:no-underline"
            >
              claim a spot →
            </Link>
          </p>
        </RevealOnView>

        {claimed === 0 ? (
          <p className="font-serif text-[24px] italic text-ink/60">
            The first Pioneer hasn&apos;t joined yet. Be №001.
          </p>
        ) : (
          <ol className="border-t-2 border-ink">
            {reverseOrder.map((founder) => (
              <li
                key={founder.number}
                className="grid grid-cols-[80px_1fr_auto] gap-6 md:gap-12 items-baseline py-5 border-b border-ink/15 max-[640px]:grid-cols-[64px_1fr] max-[640px]:gap-x-4"
              >
                <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-marketing-coral-deep">
                  №{String(founder.number).padStart(3, "0")}
                </span>
                <span className="font-serif text-[22px] md:text-[28px] leading-[1.2]">
                  {founder.name ?? "Anonymous Pioneer"}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 max-[640px]:col-start-2">
                  {new Date(founder.joinedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
