import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export function ConciergeUpsell() {
  return (
    <div className="mt-8 border border-line bg-bg-2 p-8 max-w-[640px]">
      <p className="label text-fg-3 mb-3">Pioneer benefit</p>
      <h2 className="font-serif text-[28px] leading-[1.1] tracking-[-0.02em] mb-3">
        Your AI travel concierge.
      </h2>
      <p className="text-[15px] leading-[1.5] text-fg-2 mb-5 max-w-[520px]">
        Refine your trip in chat. Search venues, propose swaps, adjust the
        budget. The concierge does the legwork; you press Apply. Reserved
        for the first 500 Pioneers.
      </p>
      <Link href="/account" className={buttonClasses({ variant: "primary" })}>
        Become a Pioneer →
      </Link>
    </div>
  );
}
