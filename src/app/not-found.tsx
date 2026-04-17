import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-7">
      <div className="max-w-[460px] text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-5">
          404 · OFF THE MAP
        </div>
        <h1 className="text-[56px] font-semibold leading-[0.95] tracking-[-0.04em] mb-4">
          Nothing here<span className="text-accent">.</span>
        </h1>
        <p className="text-fg-2 mb-8">
          This page isn&apos;t part of the trip.
        </p>
        <Link
          href="/"
          className={buttonClasses({
            size: "lg",
            className: "uppercase tracking-[0.1em] font-semibold",
          })}
        >
          Back to base →
        </Link>
      </div>
    </div>
  );
}
