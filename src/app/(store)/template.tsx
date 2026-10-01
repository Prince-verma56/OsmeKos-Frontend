"use client";

import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/storefront/lib/gsap";

export default function Template({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.8, ease: "power2.out", clearProps: "all", onComplete: () => ScrollTrigger.refresh() },
      );
    },
    { scope: ref },
  );
  return <div ref={ref}>{children}</div>;
}
