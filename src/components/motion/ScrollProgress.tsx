"use client";

import { m, useScroll, useSpring } from "motion/react";
import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/motion";

export function ScrollProgress() {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 30,
    mass: 0.4,
  });

  useEffect(() => setMounted(true), []);

  if (!mounted || reduceMotion) return null;

  return (
    <m.div
      aria-hidden="true"
      data-testid="scroll-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-marketing-coral"
      style={{ scaleX }}
    />
  );
}
