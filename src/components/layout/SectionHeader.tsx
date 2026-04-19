export function SectionHeader({
  code,
  title,
  lead,
}: {
  code: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-6 mb-10 pb-5 border-b border-line max-[400px]:grid-cols-1 max-[400px]:gap-2">
      <div>
        <h2 className="text-[40px] font-medium tracking-[-0.035em] leading-none">
          {title}
        </h2>
        {lead && (
          <p className="max-w-[600px] text-fg-2 text-[15px] mt-2">{lead}</p>
        )}
      </div>
      <div className="label text-fg-3 pb-1 max-[400px]:order-first max-[400px]:pb-0">{code}</div>
    </div>
  );
}
