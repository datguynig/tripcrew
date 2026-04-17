import { SCHEDULE } from "@/constants/trip";

export function Schedule() {
  return (
    <div className="border border-line">
      {SCHEDULE.map((row) => (
        <div
          key={row.day}
          className="grid grid-cols-[140px_1fr] max-[520px]:grid-cols-1 border-b border-line last:border-b-0 py-[22px] px-6 gap-5"
        >
          <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-accent pt-[3px]">
            {row.day}
          </div>
          <div>
            <div className="text-[20px] font-medium tracking-[-0.02em] mb-[6px]">
              {row.head}
            </div>
            <p className="text-fg-2 text-[14px] leading-[1.55]">{row.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
