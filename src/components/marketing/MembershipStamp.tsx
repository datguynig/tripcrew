type MembershipStampProps = {
  count: number;
};

export function MembershipStamp({ count }: MembershipStampProps) {
  const formatted = count.toLocaleString("en-GB");

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none -rotate-[8deg]"
    >
      <div
        className="relative border-2 border-cream bg-[#ff5e3a] px-4 py-3 shadow-[6px_6px_0_0_rgba(245,241,232,0.18)]"
        style={{ color: "#0a0a0a" }}
      >
        <div className="absolute inset-1 border border-dashed border-ink/40" />
        <div className="relative flex flex-col items-start gap-1">
          <span className="font-mono uppercase tracking-[0.22em] text-[9px] leading-none">
            Invite only
          </span>
          <span className="font-mono uppercase tracking-[0.18em] text-[10px] leading-none">
            {formatted} on list
          </span>
        </div>
      </div>
    </div>
  );
}
