type BuiltInPublicProps = {
  applicantCount: number;
  foundingRemaining: number;
};

export function BuiltInPublic({
  applicantCount,
  foundingRemaining,
}: BuiltInPublicProps) {
  return (
    <section
      id="built-in-public"
      className="bg-ink text-cream border-y-2 border-cream/15"
    >
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-14 lg:gap-20">
          <div className="flex flex-col gap-6 max-w-[58ch]">
            <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-marketing-coral">
              Built in public
            </p>
            <h2 className="font-serif text-[40px] md:text-[52px] leading-[1.02] tracking-[-0.025em]">
              One founder. Real timelines. No vapourware.
            </h2>
            <p className="text-[17px] leading-[1.6] text-cream/75">
              Tripcrew is built and shipped by Nigel Attamensah, solo, in
              London. Every founding crew member shapes what gets built next.
              Roadmap is public, decisions are explained, and what ships, ships.
            </p>

            <div className="grid grid-cols-2 gap-px bg-cream/15 border border-cream/15 mt-4 max-w-[520px]">
              <Stat label="On the waitlist" value={applicantCount.toLocaleString("en-GB")} />
              <Stat label="Founding spots left" value={`${foundingRemaining}`} />
              <Stat label="Features live" value="9" />
              <Stat label="Weeks shipping" value="12" />
            </div>
          </div>

          <aside className="relative bg-marketing-coral text-ink p-8 md:p-10 flex flex-col gap-6 self-start">
            <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-ink/70">
              Founder note
            </p>
            <p className="font-serif text-[20px] md:text-[22px] leading-[1.45] tracking-[-0.01em]">
              I built Tripcrew because every group trip I&apos;ve ever planned
              died in a group chat. So I&apos;m fixing that, in public, with the
              first 500 crews. Sign on, and the roadmap is yours to push.
            </p>
            <p className="font-serif italic text-[18px] leading-[1.4]">
              Nigel
              <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/70 ml-3">
                · Founder
              </span>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink p-5 flex flex-col gap-2">
      <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/55">
        {label}
      </p>
      <p className="font-serif text-[28px] md:text-[32px] leading-none tracking-[-0.02em] text-cream">
        {value}
      </p>
    </div>
  );
}
