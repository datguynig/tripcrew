"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

import { duration, easeOutExpo } from "./easings";

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: duration.reveal, ease: easeOutExpo }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
