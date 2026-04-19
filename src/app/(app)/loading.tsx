import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div
      className="py-14 pb-24 section-enter"
      role="status"
      aria-label="Loading"
    >
      <div className="mb-10">
        <Skeleton variant="line" className="w-[120px] mb-5" />
        <Skeleton className="w-[280px] h-[48px] mb-4" />
        <Skeleton variant="line" className="w-full max-w-[560px] mb-2" />
        <Skeleton variant="line" className="w-full max-w-[480px]" />
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-[96px]" />
        <Skeleton className="h-[96px]" />
        <Skeleton className="h-[96px]" />
      </div>
    </div>
  );
}
