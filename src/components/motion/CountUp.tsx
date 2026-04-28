"use client";

import {
  animate,
  m,
  useInView,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  duration as durations,
  easeOutExpo,
  usePrefersReducedMotion,
} from "@/lib/motion";

type CountUpProps = {
  to: number;
  durationSec?: number;
  format?: (value: number) => string;
  className?: string;
  amount?: number;
};

export function CountUp({
  to,
  durationSec = 1.2,
  format = (value) => Math.round(value).toLocaleString("en-GB"),
  className,
  amount = 0.5,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const inView = useInView(ref, { once: true, amount });
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceMotion = mounted && Boolean(prefersReducedMotion);
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => format(v));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, {
      duration: durationSec ?? durations.reveal,
      ease: easeOutExpo,
    });
    return () => controls.stop();
  }, [inView, reduceMotion, to, durationSec, value]);

  return (
    <m.span ref={ref} className={className}>
      {text}
    </m.span>
  );
}
