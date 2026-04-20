export function DaySeparator({ label }: { label: string }) {
  return (
    <div role="separator" className="flex items-center gap-4 my-8">
      <div className="flex-1 h-px bg-line" />
      <div className="label-sm-wide text-fg-3">{label}</div>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}
