"use client";

import { m } from "motion/react";

import { duration, easeOutExpo } from "@/lib/motion";

type ScaleYOnViewProps = {
  className?: string;
  delay?: number;
};

export function ScaleYOnView({ className, delay = 0 }: ScaleYOnViewProps) {
  return (
    <m.span
      aria-hidden="true"
      className={className}
      initial={{ scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      viewport={{ once: true, amount: 0.4, margin: "0px 0px -15% 0px" }}
      transition={{ duration: duration.reveal, ease: easeOutExpo, delay }}
    />
  );
}
