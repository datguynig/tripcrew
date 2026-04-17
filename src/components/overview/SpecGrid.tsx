import { SPEC } from "@/constants/trip";

export function SpecGrid() {
  return (
    <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1 border border-line mb-9">
      {SPEC.map((cell, i) => (
        <div
          key={cell.label}
          className={`py-[22px] px-6 border-r border-b border-line ${
            i % 4 === 3 ? "border-r-0" : ""
          } ${i >= SPEC.length - (SPEC.length % 4 || 4) ? "last:border-b-0" : ""} max-[900px]:[&:nth-child(2n)]:border-r-0 max-[900px]:[&:nth-last-child(-n+2)]:border-b-0 max-[520px]:border-r-0 max-[520px]:last:border-b-0`}
        >
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 mb-3">
            {cell.label}
          </div>
          <div className="text-[22px] font-medium tracking-[-0.02em] leading-[1.15]">
            {cell.value}
          </div>
          <div className="text-[13px] text-fg-3 mt-[6px]">{cell.sub}</div>
        </div>
      ))}
    </div>
  );
}
