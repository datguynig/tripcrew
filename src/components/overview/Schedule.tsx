type Row = { day: string; head: string; body: string };

export function Schedule({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="border border-line py-14 text-center font-mono text-[11px] tracking-[0.15em] uppercase text-fg-3">
        Schedule empty · admin can set it in settings
      </div>
    );
  }
  return (
    <div className="border border-line">
      {rows.map((row, i) => (
        <div
          key={`${row.day}-${i}`}
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
